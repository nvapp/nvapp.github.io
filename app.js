// --- DOM ELEMENTLERİNİ SEÇME ---
const locationText = document.getElementById('location-text');
const dateText = document.getElementById('date-text');
const getLocationBtn = document.getElementById('get-location-btn');
const searchBtn = document.getElementById('search-btn');
const cityInput = document.getElementById('city-input');
const countdownTimer = document.getElementById('countdown-timer');
const nextPrayerName = document.getElementById('next-prayer-name');

const timeElements = {
    imsak: document.getElementById('time-imsak'),
    gunes: document.getElementById('time-gunes'),
    ogle: document.getElementById('time-ogle'),
    ikindi: document.getElementById('time-ikindi'),
    aksam: document.getElementById('time-aksam'),
    yatsi: document.getElementById('time-yatsi')
};

const cardElements = {
    imsak: document.getElementById('card-imsak'),
    gunes: document.getElementById('card-gunes'),
    ogle: document.getElementById('card-ogle'),
    ikindi: document.getElementById('card-ikindi'),
    aksam: document.getElementById('card-aksam'),
    yatsi: document.getElementById('card-yatsi')
};

let currentPrayerTimes = {};
let countdownInterval;

// --- 1. ARAMA, KONUM VE RAKIM İŞLEMLERİ ---

// Şehir ve Koordinatlara Göre Rakım Çekme (Open-Meteo API)
async function getElevation(lat, lng) {
    try {
        const response = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
        const data = await response.json();
        return data.elevation ? data.elevation[0] : 0;
    } catch (error) {
        console.warn("Rakım çekilemedi, 0 metre (deniz seviyesi) varsayılıyor.");
        return 0; // Hata durumunda deniz seviyesi
    }
}

// Manuel Şehir Arama (OpenStreetMap API)
searchBtn.addEventListener('click', async () => {
    const city = cityInput.value.trim();
    if (!city) return;
    
    locationText.innerText = "Aranıyor...";
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${city}&format=json&limit=1`);
        const data = await response.json();
        
        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            const cityName = data[0].display_name.split(',')[0]; 
            
            // Rakımı da çek
            const elevation = await getElevation(lat, lng);
            
            locationText.innerText = `${cityName} (Rakım: ${Math.round(elevation)}m)`;
            calculateAndDisplayTimes(lat, lng, elevation);
        } else {
            locationText.innerText = "Şehir bulunamadı!";
        }
    } catch (error) {
        locationText.innerText = "Bağlantı hatası!";
    }
});

// GPS ile Konum Alma
getLocationBtn.addEventListener('click', () => {
    if ("geolocation" in navigator) {
        locationText.innerText = "GPS ve Rakım aranıyor...";
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                // Rakımı çek
                const elevation = await getElevation(lat, lng);
                
                locationText.innerText = `GPS: ${lat.toFixed(2)}°, ${lng.toFixed(2)}° (${Math.round(elevation)}m)`;
                calculateAndDisplayTimes(lat, lng, elevation);
            },
            () => { locationText.innerText = "GPS izni reddedildi!"; }
        );
    }
});

// --- 2. KÜRESEL ASTRONOMİ, RAKIM VE DİYANET ALGORİTMASI ---
function calculateAndDisplayTimes(lat, lng, elevation = 0) {
    const now = new Date();
    dateText.innerText = now.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });

    // Yılın Günü ve Gamma (NOAA)
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    const gamma = (2 * Math.PI / 365) * (dayOfYear - 1 + (12 - 12) / 24);

    // Deklinasyon ve Zaman Denklemi
    const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 
                 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 
                 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);

    const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 
                             0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));

    const timeZone = -(now.getTimezoneOffset() / 60);
    const noonOffset = (timeZone * 60 - lng * 4) - eqTime; 
    const solarNoon = 12 + noonOffset / 60; 

    // Saat Açısı Hesaplama
    function getHourAngle(angleDeg) {
        const latRad = lat * Math.PI / 180;
        const angleRad = angleDeg * Math.PI / 180;
        const cosOmega = (Math.sin(angleRad) - Math.sin(latRad) * Math.sin(decl)) / (Math.cos(latRad) * Math.cos(decl));
        if (cosOmega < -1 || cosOmega > 1) return null; 
        return (Math.acos(cosOmega) * 180 / Math.PI) / 15; 
    }

    // Ufuk Alçalması (Dip Angle) Hesaplama - Sadece Güneş ve Akşamı etkiler
    const dipAngle = 0.0347 * Math.sqrt(Math.max(0, elevation));
    const sunsetSunriseAngle = -0.833 - dipAngle; // Atmosferik kırılma + Ufuk alçalması

    const latRad = lat * Math.PI / 180;
    const ikindiAngleRad = Math.atan(1 / (1 + Math.tan(Math.abs(latRad - decl))));
    const ikindiAngleDeg = ikindiAngleRad * 180 / Math.PI;

    const haImsak = getHourAngle(-18);
    const haGunes = getHourAngle(sunsetSunriseAngle); 
    const haIkindi = getHourAngle(ikindiAngleDeg);
    const haYatsi = getHourAngle(-17);

    // Yuvarlama Mantığını Diyanet'e Daha Yakınlaştırma (Aşağı yuvarlayıp + margin ekleme)
    function timeToDate(decimalHours) {
        const d = new Date();
        const h = Math.floor(decimalHours);
        // Dakika hesaplanırken +0.5 dakika (30 saniye) eklenerek yukarı/aşağı yuvarlama dengelenir
        const m = Math.floor((decimalHours - h) * 60 + 0.5); 
        d.setHours(h, m, 0, 0);
        return d;
    }

    // Temkin Payları
    currentPrayerTimes = {
        imsak: timeToDate(solarNoon - haImsak),                          
        gunes: timeToDate(solarNoon - haGunes - (8 / 60)),               
        ogle: timeToDate(solarNoon + (5 / 60)),                          
        ikindi: timeToDate(solarNoon + haIkindi + (4 / 60)),             
        aksam: timeToDate(solarNoon + haGunes + (8 / 60)),               
        yatsi: timeToDate(solarNoon + haYatsi)                           
    };

    for (const [vakit, dateObj] of Object.entries(currentPrayerTimes)) {
        timeElements[vakit].innerText = dateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    }

    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(updateCountdown, 1000);
    updateCountdown();
}

// --- 3. GERİ SAYIM YÖNETİMİ ---
function updateCountdown() {
    const now = new Date();
    let nextPrayer = null;
    let nextPrayerKey = null;
    const times = Object.entries(currentPrayerTimes);
    
    for (const key of Object.keys(cardElements)) {
        cardElements[key].classList.remove('active');
    }

    for (let i = 0; i < times.length; i++) {
        const [key, time] = times[i];
        if (now < time) {
            nextPrayer = time;
            nextPrayerKey = key;
            if (i > 0) cardElements[times[i - 1][0]].classList.add('active');
            else cardElements['yatsi'].classList.add('active');
            break;
        }
    }

    if (!nextPrayer) {
        nextPrayerKey = 'imsak';
        nextPrayer = new Date(currentPrayerTimes.imsak);
        nextPrayer.setDate(nextPrayer.getDate() + 1);
        cardElements['yatsi'].classList.add('active');
    }

    nextPrayerName.innerText = nextPrayerKey;
    
    const diffMs = nextPrayer - now;
    const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);

    countdownTimer.innerText = 
        `${diffHrs.toString().padStart(2, '0')}:${diffMins.toString().padStart(2, '0')}:${diffSecs.toString().padStart(2, '0')}`;
}
