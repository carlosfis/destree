// Datos demo: células y cuentas por nivel (admin = la cuenta existente). `key` referencia desde los árboles (cells, owner, assignees, lead).
export const cells = [
  { key: 'retail', name: 'Retail Digital', color: 'orange', description: 'Ambar.mx, App Ambar, marketplace y whitelabels del grupo.', lead: 'renata' },
  { key: 'banca', name: 'Banca Digital', color: 'yellow', description: 'Banco Cobalto App, crédito digital, remesas y Empeño Ágil.', lead: 'camila' },
  { key: 'cobranza', name: 'Cobranza', color: 'green', description: 'App Campo, terminal PAX y gestión en campo.', lead: 'renata' },
  { key: 'plataforma', name: 'Ingeniería de Plataforma', color: 'blue', description: 'Servicios compartidos, librerías core, SDKs y observabilidad.', lead: 'ivan' },
];
export const users = [
  { key: 'ximena', email: 'ximena.prado@grupo.demo', name: 'Ximena Prado', role: 'ops', cells: ['retail', 'banca', 'cobranza', 'plataforma'], title: 'Design Ops · ve y administra todo (usuarios, respaldos, audit)' },
  { key: 'emilio', email: 'emilio.cordero@grupo.demo', name: 'Emilio Cordero', role: 'head', cells: ['retail', 'banca'], title: 'Head of Design · ve todas las páginas, edita, controla visibilidad y versiones' },
  { key: 'renata', email: 'renata.villasenor@grupo.demo', name: 'Renata Villaseñor', role: 'lead', cells: ['retail', 'cobranza'], title: 'Lead UX · edita lo visible para sus células (Retail Digital, Cobranza), invita a sus células' },
  { key: 'ivan', email: 'ivan.robles@grupo.demo', name: 'Iván Robles', role: 'lead', cells: ['plataforma'], title: 'Lead de Ingeniería · ve y edita la Plataforma Tecnológica (solo-células)' },
  { key: 'camila', email: 'camila.ibarra@grupo.demo', name: 'Camila Ibarra', role: 'lead', cells: ['banca'], title: 'Lead de Banca Digital · responsable de Banco Cobalto App' },
  { key: 'mateo', email: 'mateo.arriaga@grupo.demo', name: 'Mateo Arriaga', role: 'viewer', cells: ['cobranza'], title: 'QA · solo lectura; edita la card y la página de proyecto «Asignación de investigaciones» (asignado)' },
  { key: 'gael', email: 'gael.montes@grupo.demo', name: 'Gael Montes', role: 'viewer', cells: ['plataforma'], title: 'Front end · solo lectura; responsable de «Aurora Web Kit» y asignado en «Portal de Desarrolladores»' },
];
