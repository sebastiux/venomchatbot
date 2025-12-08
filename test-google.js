// test-google.js
import googleService from './src/services/GoogleService.js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

console.log('🧪 TEST DE INTEGRACIÓN GOOGLE (Opción 1)\n');
console.log('='.repeat(60));

// Datos de prueba
const testData = {
  name: 'Carlos Test',
  company: 'Test Company SA',
  service: 'Desarrollo de Software',
  email: 'carlos.test@ejemplo.com',
  phone: '+5215512345678',
  fecha: '2025-10-30', // Cambia por una fecha futura cercana
  hora: '15:00'
};

console.log('📋 Datos de prueba:');
console.log(JSON.stringify(testData, null, 2));
console.log('='.repeat(60));
console.log('\n🚀 Iniciando prueba...\n');

async function runTest() {
  try {
    // 1. Registrar cita
    console.log('1️⃣ Registrando cita en Google...');
    const resultado = await googleService.registrarCita(testData);
    
    if (!resultado.success) {
      console.log('\n❌ ERROR AL REGISTRAR:');
      console.log('   Mensaje:', resultado.error);
      return;
    }

    console.log('\n✅ CITA REGISTRADA EXITOSAMENTE!\n');
    console.log('='.repeat(60));
    console.log('📊 RESULTADOS:');
    console.log('='.repeat(60));
    console.log(`Event ID:    ${resultado.eventId}`);
    console.log(`Fecha/Hora:  ${resultado.startDateTime}`);
    console.log(`\n🎥 Meet Link:\n${resultado.meetLink}`);
    console.log(`\n📅 Calendar Link:\n${resultado.htmlLink}`);
    console.log('='.repeat(60));

    // 2. Generar archivo .ics
    console.log('\n2️⃣ Generando archivo .ics...');
    const icsContent = googleService.generarICS(testData, resultado.meetLink);
    fs.writeFileSync('consulta-test.ics', icsContent);
    console.log('✅ Archivo guardado: consulta-test.ics');
    console.log('   Puedes abrirlo para agregarlo a cualquier calendario');

    // 3. Simular mensaje de WhatsApp
    console.log('\n3️⃣ Simulando mensaje de WhatsApp que recibiría el usuario:\n');
    console.log('─'.repeat(60));
    const whatsappMessage = [
      '✅ *¡Cita Agendada Exitosamente!*',
      '',
      `📋 *Detalles de tu consulta:*`,
      `👤 ${testData.name}`,
      `🏢 ${testData.company}`,
      `💼 ${testData.service}`,
      `📅 ${resultado.startDateTime}`,
      '',
      '🎥 *Link de Google Meet:*',
      resultado.meetLink,
      '',
      '📌 *Agregar a tu calendario:*',
      resultado.htmlLink,
      '',
      '💡 *Tip:* Guarda este mensaje o toma captura',
      '',
      'Nos vemos en la consulta! 🙏'
    ].join('\n');
    console.log(whatsappMessage);
    console.log('─'.repeat(60));

    // 4. Verificar en Google Sheets
    console.log('\n4️⃣ Verificando registro en Google Sheets...');
    console.log(`   Abre tu Sheet: https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}`);
    console.log('   Deberías ver una nueva fila con los datos de prueba');

    // 5. Verificar en Google Calendar
    console.log('\n5️⃣ Verificando en Google Calendar...');
    console.log('   Abre tu calendario y busca el evento');
    console.log('   O usa este link directo:', resultado.htmlLink);

    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST COMPLETADO EXITOSAMENTE!');
    console.log('='.repeat(60));
    console.log('\n📝 SIGUIENTES PASOS:');
    console.log('   1. Verifica el Google Sheet');
    console.log('   2. Abre el evento en Calendar');
    console.log('   3. Prueba el link de Meet');
    console.log('   4. Abre el archivo consulta-test.ics');
    console.log('\n🎉 Todo listo para integrar en tu bot!\n');

  } catch (error) {
    console.error('\n❌ ERROR EN EL TEST:');
    console.error('   Mensaje:', error.message);
    console.error('   Stack:', error.stack);
    
    console.log('\n🔍 POSIBLES CAUSAS:');
    console.log('   • El archivo google-credentials.json no existe o está mal ubicado');
    console.log('   • No compartiste el Google Sheet con la service account');
    console.log('   • El GOOGLE_SHEET_ID en .env es incorrecto');
    console.log('   • Las APIs no están habilitadas en Google Cloud Console');
    console.log('   • La pestaña "Citas" no existe en el Sheet');
  }
}

// Verificaciones previas
console.log('🔍 Verificando configuración...\n');

const checks = [
  { 
    name: 'Archivo google-credentials.json', 
    test: () => fs.existsSync('./google-credentials.json') 
  },
  { 
    name: 'Variable GOOGLE_SHEET_ID', 
    test: () => !!process.env.GOOGLE_SHEET_ID 
  },
  { 
    name: 'Variable KARUNA_EMAIL', 
    test: () => !!process.env.KARUNA_EMAIL 
  }
];

let allChecksPass = true;
checks.forEach(check => {
  const pass = check.test();
  console.log(`${pass ? '✅' : '❌'} ${check.name}`);
  if (!pass) allChecksPass = false;
});

if (!allChecksPass) {
  console.log('\n❌ Faltan configuraciones. Por favor revisa los puntos marcados.\n');
  process.exit(1);
}

console.log('\n✅ Todas las configuraciones OK\n');
console.log('='.repeat(60));

// Ejecutar test
runTest();