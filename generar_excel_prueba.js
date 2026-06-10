const XLSX = require('xlsx');
const fs = require('fs');

const data = [
  {
    'Nombre': 'JUAN',
    'Apellido': 'PEREZ',
    'Cedula': '12345678',
    'Rol': 'Médico',
    'Email': 'juan.perez@ejemplo.com',
    'Teléfono': '04141234567',
    'Piso': '1',
    'Sede': 1
  },
  {
    'Nombre': 'MARIA',
    'Apellido': 'LOPEZ',
    'Cedula': '87654321',
    'Rol': 'Recepcionista',
    'Email': 'maria.lopez@ejemplo.com',
    'Teléfono': '04127654321',
    'Piso': 'PB',
    'Sede': 1
  },
  {
    'Nombre': 'CARLOS',
    'Apellido': 'RODRIGUEZ',
    'Cedula': '11223344',
    'Rol': 'Administrador',
    'Email': 'carlos.admin@ejemplo.com',
    'Teléfono': '04241112233',
    'Sede': 1
  },
  {
    'Nombre': 'ANA',
    'Apellido': 'MARTINEZ',
    'Cedula': '55667788',
    'Rol': 'Analista',
    'Email': 'ana.aps@ejemplo.com',
    'Teléfono': '04164445566',
    'Piso': '2',
    'Sede': 1
  },
  {
    'Nombre': 'LUIS',
    'Apellido': 'GARCIA',
    'Cedula': '99001122',
    'Rol': 'Laboratorio',
    'Email': 'luis.lab@ejemplo.com',
    'Teléfono': '04149990011',
    'Piso': 'Sótano',
    'Sede': 1
  }
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Personal');

const fileName = 'prueba_personal_multirol.xlsx';
XLSX.writeFile(wb, fileName);

console.log(`Archivo ${fileName} creado con éxito.`);
