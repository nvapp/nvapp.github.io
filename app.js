// --- DOM ELEMENTLERİNİ SEÇME ---
const locationText = document.getElementById('location-text');
const dateText = document.getElementById('date-text');
const getLocationBtn = document.getElementById('get-location-btn');
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

// Global değişkenler
let currentPrayerTimes = {};
let countdownInterval;

// --- 1. KONUM ALMA İŞLEMİ (GEOLOCATION API) ---
getLocationBtn.addEventListener('click', () => {
    if ("geolocation" in navigator) {
        locationText.innerText = "Konum bulunuyor...";
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                locationText.innerText = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                
                // Konum bulununca vakitleri hesapla ve sayacı başlat
                calculateAndDisplayTimes(lat, lng);
            },
            (error) => {
                locationText.innerText = "Konum izni reddedildi!";
                console.error("Konum hatası:", error);
            }
        );
    } else {
        locationText.innerText = "Tarayıcınız konumu desteklemiyor.";
    }
});

// --- 2. VAKİT HESAPLAMA VE DİYANET ALGORİTMASI ---
function calculateAndDisplayTimes(lat, lng) {
    const now = new Date();
    
    // Tarihi Ekrana Yazdır
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    dateText.innerText = now.toLocaleDateString('tr-TR', options);

    /* ASTRONOMİK HESAPLAMALAR BURADA YAPILIR.
      Not: Burada Güneş'in Deklinasyon (Declination) ve Zaman Denklemi (Equation of Time)
      verilerini hesaplayan standart NOAA formüllerinin sonuçları kullanılır.
      
      Aşağıdaki nesne, senin bulduğun Diyanet "Temkin Payları" algoritmasına uygun
      olarak saatlerin (ondalık formatta) döndürüldüğü varsayılarak oluşturulmuştur.
    */
    
    // ÖRNEK/HESAPLANMIŞ VERİ SETİ (Kendi astronomi fonksiyonlarından dönecek veriler buraya gelmeli)
    // Saatleri Date objesine dönüştürüyoruz.
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Kendi formüllerini entegre edeceğin yer burasıdır.
    // Şimdilik sistemin çalışmasını görmek için örnek saatler tanımlıyoruz.
    currentPrayerTimes = {
        imsak: addMinutesToDate(today, (4 * 60) + 15),   // 04:15 (Saf Astronomi -18°)
        gunes: addMinutesToDate(today, (5 * 60) + 40),   // 05:40 (Astronomi - 8 dk)
        ogle: addMinutesToDate(today, (13 * 60) + 10),   // 13:10 (Zeval + 5 dk)
        ikindi: addMinutesToDate(today, (16 * 60) + 55), // 16:55 (Gölge 1x + Öğle gölgesi + 4 dk)
        aksam: addMinutesToDate(today, (20 * 60) + 20),  // 20:20 (Astronomi + 8 dk)
        yatsi: addMinutesToDate(today, (21 * 60) + 50)   // 21:50 (Saf Astronomi -17°)
    };

    // Arayüze Saatleri Yazdır
    for (const [vakit, dateObj] of Object.entries(currentPrayerTimes)) {
        timeElements[vakit].innerText = dateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    }

    // Geri sayımı başlat
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(updateCountdown, 1000);
    updateCountdown(); // İlk saniyeyi beklemeden hemen çalıştır
}

// --- 3. GERİ SAYIM VE AKTİF VAKİT MANTIĞI ---
function updateCountdown() {
    const now = new Date();
    let nextPrayer = null;
    let nextPrayerKey = null;

    // Hangi vakitte olduğumuzu bul ve sonrakini belirle
    const times = Object.entries(currentPrayerTimes);
    
    // Tüm kartlardaki aktifliği temizle
    for (const key of Object.keys(cardElements)) {
        cardElements[key].classList.remove('active');
    }

    for (let i = 0; i < times.length; i++) {
        const [key, time] = times[i];
        if (now < time) {
            nextPrayer = time;
            nextPrayerKey = key;
            
            // İçinde bulunduğumuz vakti vurgula (bir önceki indeks)
            if (i > 0) {
                const currentPrayerKey = times[i - 1][0];
                cardElements[currentPrayerKey].classList.add('active');
            } else {
                // Eğer imsaktan önceyse yatsı aktiftir
                cardElements['yatsi'].classList.add('active');
            }
            break;
        }
    }

    // Eğer tüm vakitler geçtiyse (Yatsıdan sonraysa), sonraki vakit yarının İmsak'ıdır
    if (!nextPrayer) {
        nextPrayerKey = 'imsak';
        nextPrayer = new Date(currentPrayerTimes.imsak);
        nextPrayer.setDate(nextPrayer.getDate() + 1); // Yarının imsakı
        cardElements['yatsi'].classList.add('active'); // Halen yatsı vaktindeyiz
    }

    // Arayüzü Güncelle
    nextPrayerName.innerText = nextPrayerKey;
    
    // Zaman farkını hesapla
    const diffMs = nextPrayer - now;
    const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);

    // Formatla (0 eklentisi) ve ekrana yaz
    countdownTimer.innerText = 
        `${diffHrs.toString().padStart(2, '0')}:${diffMins.toString().padStart(2, '0')}:${diffSecs.toString().padStart(2, '0')}`;
}

// --- YARDIMCI FONKSİYONLAR ---
// Gece yarısı baz alınarak dakika ekleyen yardımcı fonksiyon
function addMinutesToDate(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
}
