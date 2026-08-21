/**
 * DICCIONARIO DE PRONUNCIACIÓN.
 *
 * Nombres guardados en la BD (en MAYÚSCULAS, como se guardan) -> cómo deben
 * sonar en la voz del turnero. Se aplica ANTES de enviar el texto a Piper TTS.
 *
 * Para agregar un nombre difícil: añade una entrada con la clave en
 * MAYÚSCULAS (tal como está en la base de datos) y el valor con la
 * pronunciación deseada (ej. 'JHONATAN': 'Jonathan').
 */
const DICCIONARIO = {
  'YULIBETH': 'Yulibet',
  'BRICEIDA': 'Briseda',
  'EIDER': 'Eider',
  'NAIDEL': 'Naidel',
  'DARIELIS': 'Dariélis',
  'YORBELIS': 'Yorbelis',
  'YUCEID': 'Yuseid',
  'YANIRA': 'Yanira',
  'YOHANA': 'Yohana',
  'YESENIA': 'Yesenia',
  'YORMAN': 'Yorman',
  'YONAIRA': 'Yonaira',
  'YERIKSON': 'Yerikson',
  'YUBERLY': 'Yuberli',
  'BRAHIM': 'Braim',
  'CRISTOPHER': 'Cristófer',
  'JHORTENSIA': 'Hortensia',
  'NAIBERLY': 'Naiberli',
  'DUGLARY': 'Duglari',
  'JHAIR': 'Jair',
  'JHEAN': 'Jean',
  'JEAN': 'Yan',
  'JHONATAN': 'Jonatan',
  'JHONNY': 'Yonny',
  'JHOSSELIN': 'Josselin',
  'KHRISTIAN': 'Khristian',
  'NIURKYS': 'Niurkis',
  'RUSSNAIDER': 'Rusnaider',
  'YAKELINE': 'Yakeline',
  'YARELBIS': 'Yarelbis',
  'YERIDIANA': 'Yeridiana',
  'YULIMAR': 'Yulimar',
  'EDWARD': 'Eduar',
};

module.exports = DICCIONARIO;
