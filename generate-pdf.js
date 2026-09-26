const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const htmlPath = path.resolve(__dirname, 'manual-usuario-sgrh.html');
const pdfPath = path.resolve(__dirname, 'Manual_de_Usuario_SGRH_Tropico_56.pdf');

console.log('Compilando PDF desde:', htmlPath);
console.log('Destino PDF:', pdfPath);

const args = [
    '--headless=new',
    '--disable-gpu',
    '--run-all-compositor-stages-before-draw',
    '--no-pdf-header-footer',
    `--print-to-pdf=${pdfPath}`,
    htmlPath
];

execFile(edgePath, args, (error, stdout, stderr) => {
    if (error) {
        console.error('Error al ejecutar Edge:', error);
        process.exit(1);
    }
    setTimeout(() => {
        if (fs.existsSync(pdfPath)) {
            const stats = fs.statSync(pdfPath);
            console.log('PDF generado exitosamente!');
            console.log('Archivo:', pdfPath);
            console.log('Tamaño:', (stats.size / 1024).toFixed(2), 'KB');
            process.exit(0);
        } else {
            console.error('El archivo PDF no se encontró tras la ejecución.');
            process.exit(1);
        }
    }, 1500);
});
