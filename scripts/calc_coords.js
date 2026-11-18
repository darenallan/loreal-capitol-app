function dmsToDd(d, m, s, dir) {
  let dd = d + m / 60 + s / 3600;
  if (dir === 'S' || dir === 'W') dd = -dd;
  return Number(dd.toFixed(6));
}

// Tougou: 3°52'56.9"N 11°31'24.1"E
const tougouLat = dmsToDd(3, 52, 56.9, 'N');
const tougouLng = dmsToDd(11, 31, 24.1, 'E');

// Falaise: 3°52'13.7"N 11°30'57.9"E
const falaiseLat = dmsToDd(3, 52, 13.7, 'N');
const falaiseLng = dmsToDd(11, 30, 57.9, 'E');

console.log('Tougou:', { lat: tougouLat, lng: tougouLng, dms: '3°52\'56.9"N 11°31\'24.1"E' });
console.log('Falaise:', { lat: falaiseLat, lng: falaiseLng, dms: '3°52\'13.7"N 11°30\'57.9"E' });

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const dist = haversine(falaiseLat, falaiseLng, tougouLat, tougouLng);
console.log('Distance vol d\'oiseau:', dist.toFixed(2), 'km');
console.log('Distance routière estimée (~1.3x):', (dist * 1.3).toFixed(2), 'km');
