// Páginas de proyecto demo de «Plataforma Tecnológica»: Pagos Core (tokenización PCI) e Identidad (MFA y passkeys).
const day = n => { const d = new Date(); d.setUTCHours(12, 0, 0, 0); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const st = (a, b) => (b < 0 ? 'done' : a > 0 ? 'todo' : 'doing');
const A = (title, description, tag, assignee, phaseId, a, b, status) => ({ title, description, tag, assignee, phaseId, startDate: day(a), endDate: day(b), status: status || st(a, b) });
const K = (title, description, assignee, status) => ({ title, description, assignee, status });
const L = (emoji, label, url) => ({ emoji, label, url });
const P = (name, role) => ({ name, role });
const sec = (kind, title, data) => ({ kind, title, data });
const GH = 'https://github.com/grupo-demo', CONF = 'https://confluence.grupo.demo/wiki';

export const projects = [
  { nodeId: 'pl_pagos', settings: { tagline: 'Sacar el número de tarjeta de nuestros servicios: tokenización en cliente, bóveda certificada y un alcance PCI 60 % menor.', sprintWeeks: 2, sprintOffset: 0 },
    sections: [
      sec('links', 'Ficha técnica', { items: [L('🐙', 'GitHub · payments', `${GH}/payments`), L('📘', 'OpenAPI', 'https://api.grupo.demo/docs/payments'), L('📈', 'Grafana · pagos', 'https://grafana.grupo.demo/d/payments'), L('📓', 'Runbook', `${CONF}/payments/runbook`), L('🔒', 'Alcance PCI', `${CONF}/pci`)] }),
      sec('text', 'Resumen', { text: 'Pagos Core orquesta tarjetas, crédito y QR para todos los canales del grupo. Hoy el PAN atraviesa cuatro servicios, lo que mantiene a todo el clúster dentro del alcance PCI DSS. El proyecto introduce tokenización en el cliente (Pagos SDK), una bóveda de tokens certificada y reintentos idempotentes, para reducir el alcance, bajar la latencia y preparar la expansión a Guatemala.', metrics: [{ value: '1.8M', label: 'transacciones / día' }, { value: '99.95%', label: 'SLO disponibilidad' }, { value: '180 ms', label: 'p95 actual' }] }),
      sec('timeline', 'Antecedentes', { items: [{ label: '2021', text: 'Monolito de pagos en Java dentro del core bancario.' }, { label: '2023', text: 'Pagos Core como servicio independiente; Payments Lib compartida con Órdenes.' }, { label: '2025', text: 'Auditoría PCI DSS 4.0: 14 hallazgos, 9 relacionados con el manejo del PAN.' }, { label: '2026', text: 'Tokenización y bóveda; expansión a Guatemala.' }] }),
      sec('cards', 'Consumidores', { items: [{ code: 'C1', title: 'Ambar.mx y App Ambar', text: 'Checkout y wallet vía Pagos SDK.' }, { code: 'C2', title: 'Punto de Venta', text: '1,200 tiendas; cobro con tarjeta presente.' }, { code: 'C3', title: 'Banco Cobalto App', text: 'Pagos de servicios y transferencias con tarjeta.' }] }),
      sec('quote', 'Principio de diseño', { quote: 'Ningún número de tarjeta debe tocar nuestros servidores: se tokeniza en el cliente y la bóveda es el único custodio.', highlight: 'se tokeniza en el cliente', items: [{ title: 'Alcance PCI', text: 'Solo la bóveda queda dentro del alcance.' }, { title: 'Idempotencia', text: 'Reintentos seguros con clave por operación.' }, { title: 'Observabilidad', text: 'Trazas de extremo a extremo con Telemetry Lib.' }] }),
      sec('goals', 'Objetivos', { items: [{ text: 'Servicios dentro del alcance PCI', value: '4 → 1' }, { text: 'Latencia p95', value: '180 ms → 120 ms' }, { text: 'Incidentes Sev1 por trimestre', value: '3 → 0' }, { text: 'Costo de auditoría', value: '−40%' }] }),
      sec('checklist', 'Entregables', { items: [{ text: 'Diseño de arquitectura (ADR-042)', done: true }, { text: 'Bóveda de tokens', done: true }, { text: 'Pagos SDK con tokenización', done: false }, { text: 'Migración de consumidores', done: false }, { text: 'Certificación PCI', done: false }, { text: 'Despliegue Guatemala', done: false }] }),
      sec('people', 'Equipo', { items: [P('Lucía Navarro', 'Tech Lead Pagos'), P('Óscar Valdez', 'SRE'), P('Andrés Quiroga', 'Seguridad'), P('Gael Montes', 'Front end · SDK'), P('Bruno Salcedo', 'Backend')] }),
      sec('people', 'Stakeholders', { items: [P('Iván Robles', 'Head de Plataforma'), P('Ximena Prado', 'PO Retail'), P('Camila Ibarra', 'PO Banca')] }),
    ],
    phases: [{ id: 'f1', name: 'Descubrimiento técnico' }, { id: 'f2', name: 'Diseño de arquitectura' }, { id: 'f3', name: 'Implementación' }, { id: 'f4', name: 'Certificación y rollout' }],
    activities: [
      A('Inventario de flujos con PAN', 'Trazar cada servicio que recibe, guarda o loguea el PAN', 'SEC', '@Andrés Quiroga', 'f1', -35, -26), A('Benchmark de bóvedas', 'Proveedor certificado vs. bóveda propia', 'ARQ', '@Lucía Navarro', 'f1', -30, -22),
      A('ADR-042 tokenización', 'Decisión de arquitectura y revisión con seguridad', 'ARQ', '@Lucía Navarro', 'f2', -20, -12), A('Contratos de API', 'OpenAPI de bóveda y cambios en Payments Lib', 'BE', '@Bruno Salcedo', 'f2', -14, -5), A('Plan de pruebas de carga', 'Escenarios de 3x pico (Buen Fin)', 'SRE', '@Óscar Valdez', 'f2', -8, -2),
      A('Bóveda de tokens', 'Servicio aislado, HSM y rotación de llaves', 'BE', '@Bruno Salcedo', 'f3', -4, 18), A('Pagos SDK: tokenización en cliente', 'Captura segura en web y mobile', 'FE', '@Gael Montes', 'f3', 0, 22), A('Migración de consumidores', 'Ambar.mx, POS y Cobalto detrás de feature flag', 'BE', '@Lucía Navarro', 'f3', 20, 42), A('Pruebas de carga', 'Validar p95 < 120 ms a 3x', 'SRE', '@Óscar Valdez', 'f3', 40, 46),
      A('Auditoría PCI', 'Evidencias y revisión del QSA', 'SEC', '@Andrés Quiroga', 'f4', 48, 62), A('Rollout Guatemala', 'Adquirente local y conciliación', 'BE', '@Lucía Navarro', 'f4', 60, 74),
      K('Deprecación de la API v1', 'Comunicar a consumidores y fijar fecha', '@Lucía Navarro', 'todo'), K('Reintentos idempotentes en Orders', 'Alinear con Órdenes y Logística', '@Bruno Salcedo', 'doing'), K('Migrar logs con PAN enmascarado', 'Ya cubierto por la bóveda', '@Andrés Quiroga', 'cancelled'),
    ] },
  { nodeId: 'pl_sso', settings: { tagline: 'Un solo inicio de sesión para 25 millones de cuentas, con segundo factor sin fricción y passkeys como camino sin contraseña.', sprintWeeks: 1, sprintOffset: 0 },
    sections: [
      sec('links', 'Ficha técnica', { items: [L('🐙', 'GitHub · sso', `${GH}/sso`), L('📘', 'OpenAPI', 'https://api.grupo.demo/docs/sso'), L('📈', 'Grafana · sso', 'https://grafana.grupo.demo/d/sso'), L('📓', 'Runbook', `${CONF}/sso/runbook`)] }),
      sec('text', 'Resumen', { text: 'Identidad concentra autenticación y autorización del grupo. El proyecto MFA 2.0 sustituye el OTP por SMS (caro y vulnerable a SIM swap) por push y passkeys, y unifica el onboarding biométrico que hoy duplican la banca y el retail.', metrics: [{ value: '25M', label: 'cuentas' }, { value: '38%', label: 'logins con MFA' }, { value: '$1.2M', label: 'costo anual de SMS' }] }),
      sec('timeline', 'Antecedentes', { items: [{ label: '2022', text: 'SSO con OIDC para apps del grupo; OTP por SMS como único segundo factor.' }, { label: '2024', text: 'Auth SDK Web y Mobile; refresh rotativo.' }, { label: '2025', text: 'Incidentes de SIM swap: 112 casos confirmados.' }, { label: '2026', text: 'MFA 2.0: push, passkeys y biometría unificada.' }] }),
      sec('cards', 'Consumidores', { items: [{ code: 'C1', title: 'Banco Cobalto App', text: 'Login biométrico y transacciones de alto riesgo.' }, { code: 'C2', title: 'Ambar.mx y App Ambar', text: 'Login social y passkeys.' }, { code: 'C3', title: 'Backoffice y portales', text: 'SSO corporativo con MFA obligatorio.' }] }),
      sec('quote', 'Principio de diseño', { quote: 'El segundo factor debe ser más seguro y más rápido que escribir una contraseña.', highlight: 'más seguro y más rápido', items: [{ title: 'Sin SMS', text: 'Push firmado y passkeys por defecto.' }, { title: 'Riesgo adaptativo', text: 'MFA solo cuando la señal lo exige.' }, { title: 'Un onboarding', text: 'Biometría compartida por banca y retail.' }] }),
      sec('goals', 'Objetivos', { items: [{ text: 'Logins con MFA', value: '38% → 85%' }, { text: 'Fraude por SIM swap', value: '112 → 0' }, { text: 'Costo de SMS', value: '−90%' }, { text: 'Tiempo de login con MFA', value: '24 s → 6 s' }] }),
      sec('checklist', 'Entregables', { items: [{ text: 'Push firmado', done: true }, { text: 'Passkeys (WebAuthn)', done: false }, { text: 'Motor de riesgo adaptativo', done: false }, { text: 'Onboarding biométrico unificado', done: false }, { text: 'Retiro de OTP por SMS', done: false }] }),
      sec('people', 'Equipo', { items: [P('Iván Robles', 'Tech Lead'), P('Andrés Quiroga', 'Seguridad'), P('Santiago Beltrán', 'iOS'), P('Fernanda Olvera', 'Android'), P('Gael Montes', 'Front end')] }),
      sec('people', 'Stakeholders', { items: [P('Camila Ibarra', 'PO Banca'), P('Ximena Prado', 'PO Retail'), P('Emilio Cordero', 'Head of Design')] }),
    ],
    phases: [{ id: 'f1', name: 'Push firmado' }, { id: 'f2', name: 'Passkeys' }, { id: 'f3', name: 'Riesgo adaptativo' }, { id: 'f4', name: 'Retiro de SMS' }],
    activities: [
      A('Push firmado en Auth SDK Mobile', 'Aprobación con biometría y firma del dispositivo', 'MOB', '@Santiago Beltrán', 'f1', -21, -8), A('Rollout de push en Cobalto', 'Por cohortes, 5 % semanal', 'PO', '@Camila Ibarra', 'f1', -7, 3),
      A('WebAuthn en Auth SDK Web', 'Registro y login con passkeys', 'FE', '@Gael Montes', 'f2', -2, 12), A('Passkeys en iOS y Android', 'Sincronizadas con llavero y Google Password Manager', 'MOB', '@Fernanda Olvera', 'f2', 2, 16), A('Pruebas con usuarios', 'Comprensión del concepto de passkey', 'UX', '@Renata Villaseñor', 'f2', 14, 19),
      A('Señales de riesgo', 'Dispositivo, geolocalización y velocidad', 'SEC', '@Andrés Quiroga', 'f3', 18, 32), A('Políticas por consumidor', 'Reglas distintas para banca y retail', 'BE', '@Iván Robles', 'f3', 26, 36),
      A('Comunicación a clientes', 'Campaña in-app y correo', 'PO', '@Ximena Prado', 'f4', 38, 45), A('Apagado de OTP por SMS', 'Solo como respaldo de emergencia', 'SEC', '@Andrés Quiroga', 'f4', 46, 50),
      K('Revisión legal de passkeys', 'Términos y consentimiento biométrico', '@Andrés Quiroga', 'doing'), K('Métricas de adopción en Grafana', 'Tablero por consumidor', '@Iván Robles', 'todo'),
    ] },
];
