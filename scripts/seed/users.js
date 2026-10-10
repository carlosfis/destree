// Datos demo: células y cuentas por nivel (admin = la cuenta existente). `key` referencia desde los árboles (cells, owner, assignees, lead).
export const cells = [
  { key: 'retail', name: 'Retail Digital', color: 'orange', description: 'Elektra.mx, App Elektra, marketplace y whitelabels del grupo.', lead: 'adriana' },
  { key: 'banca', name: 'Banca Digital', color: 'yellow', description: 'Banco Azteca App, crédito digital, remesas y Presta Prenda.', lead: 'paola' },
  { key: 'cobranza', name: 'Cobranza', color: 'green', description: 'App Líderes, terminal PAX y gestión en campo.', lead: 'adriana' },
  { key: 'plataforma', name: 'Ingeniería de Plataforma', color: 'blue', description: 'Servicios compartidos, librerías core, SDKs y observabilidad.', lead: 'jorge' },
];
export const users = [
  { key: 'mariana', email: 'mariana.soto@grupo.demo', name: 'Mariana Soto', role: 'ops', cells: ['retail', 'banca', 'cobranza', 'plataforma'], title: 'Design Ops · ve y administra todo (usuarios, respaldos, audit)' },
  { key: 'rodrigo', email: 'rodrigo.pena@grupo.demo', name: 'Rodrigo Peña', role: 'head', cells: ['retail', 'banca'], title: 'Head of Design · ve todas las páginas, edita, controla visibilidad y versiones' },
  { key: 'adriana', email: 'adriana.reyes@grupo.demo', name: 'Adriana Reyes', role: 'lead', cells: ['retail', 'cobranza'], title: 'Lead UX · edita lo visible para sus células (Retail Digital, Cobranza), invita a sus células' },
  { key: 'jorge', email: 'jorge.ramirez@grupo.demo', name: 'Jorge Ramírez', role: 'lead', cells: ['plataforma'], title: 'Lead de Ingeniería · ve y edita la Plataforma Tecnológica (solo-células)' },
  { key: 'paola', email: 'paola.cruz@grupo.demo', name: 'Paola Cruz', role: 'lead', cells: ['banca'], title: 'Lead de Banca Digital · responsable de Banco Azteca App' },
  { key: 'diego', email: 'diego.torres@grupo.demo', name: 'Diego Torres', role: 'viewer', cells: ['cobranza'], title: 'QA · solo lectura; edita la card y la página de proyecto «Asignación de investigaciones» (asignado)' },
  { key: 'luis', email: 'luis.hernandez@grupo.demo', name: 'Luis Hernández', role: 'viewer', cells: ['plataforma'], title: 'Front end · solo lectura; responsable de «Aurora Web Kit» y asignado en «Portal de Desarrolladores»' },
];
