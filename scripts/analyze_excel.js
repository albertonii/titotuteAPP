const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', '(2ºMesociclo) ADAP TEC II FUERZA  .xlsx');

console.log('=== ANÁLISIS DEL EXCEL ===');
console.log('Archivo:', filePath);

const wb = XLSX.readFile(filePath);

console.log('\nNúmero de hojas:', wb.SheetNames.length);
console.log('Nombres de hojas:', wb.SheetNames.join(', '));

wb.SheetNames.forEach((name, idx) => {
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, {header: 1, defval: null});
  
  console.log(`\n=== Hoja ${idx + 1}: ${name} ===`);
  console.log('Total filas:', rows.length);
  if (rows[0]) {
    console.log('Total columnas (fila 0):', rows[0].length);
  }
  
  // Mostrar estructura clave
  console.log('\n--- Filas clave ---');
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25].forEach(i => {
    if (rows[i]) {
      const row = rows[i].slice(0, 15).map(c => {
        const val = c === null || c === undefined ? '' : String(c);
        return val.substring(0, 20).padEnd(20);
      }).join(' | ');
      console.log(`F${i.toString().padStart(2)}: ${row}`);
    }
  });
  
  // Buscar secciones importantes
  console.log('\n--- Secciones encontradas ---');
  rows.forEach((row, i) => {
    const cellB = row[1] ? String(row[1]).toUpperCase() : '';
    if (cellB.includes('FASE') || cellB.includes('EN EL CALENTAMIENTO') || 
        cellB.includes('SERIES & REPETICIONES') || cellB.includes('TIEMPO DE PAUSA')) {
      console.log(`Fila ${i}: ${cellB.substring(0, 50)}`);
    }
  });
});

