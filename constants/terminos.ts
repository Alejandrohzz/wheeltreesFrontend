/**
 * Términos y condiciones de WheelTrees.
 *
 * Fuente única: la pantalla `app/terms.tsx` los muestra y
 * `services/terminos.ts` los envía por correo al aceptarlos, así que lo que el
 * usuario lee es exactamente lo que recibe. Si cambias el texto, sube
 * TERMINOS_VERSION.
 */

export const TERMINOS_VERSION = '1.1';
export const TERMINOS_FECHA = '2 de octubre de 2026';
export const TERMINOS_FECHA_EN = 'October 2, 2026';

/** ⚠️ Reemplaza por el correo real de soporte/contacto del proyecto. */
export const CORREO_CONTACTO = 'wheeltrees.soporte@unbosque.edu.co';

export interface SeccionTerminos {
  titulo: string;
  parrafos: string[];
}

export interface Terminos {
  titulo: string;
  version: string;
  actualizado: string;
  intro: string;
  secciones: SeccionTerminos[];
  cierre: string;
}

const ES: Terminos = {
  titulo: 'Términos y Condiciones de Uso de WheelTrees',
  version: TERMINOS_VERSION,
  actualizado: `Última actualización: ${TERMINOS_FECHA}`,
  intro:
    'Lee con atención estos Términos y Condiciones antes de usar WheelTrees. Al registrarte, publicar un viaje, reservar un cupo o registrar un vehículo, declaras que los has leído y que los aceptas.',
  secciones: [
    {
      titulo: '1. Qué es WheelTrees',
      parrafos: [
        'WheelTrees es una aplicación móvil de vehículo compartido (carpooling) para la comunidad de la Universidad El Bosque. Conecta a personas que van a hacer un mismo recorrido dentro del área metropolitana de Bogotá para que compartan el vehículo y los gastos del trayecto.',
        'WheelTrees es un proyecto académico desarrollado como trabajo de grado. La plataforma es una herramienta tecnológica de intermediación entre usuarios; no es una empresa de transporte, no presta el servicio de transporte y no es propietaria ni operadora de los vehículos.',
        'En estos términos, "los Desarrolladores" son las personas que crearon y mantienen WheelTrees, y "el Usuario" es toda persona que usa la aplicación, ya sea como conductor o como pasajero.',
      ],
    },
    {
      titulo: '2. Quién puede usar la aplicación',
      parrafos: [
        'Solo pueden registrarse miembros de la comunidad universitaria con un correo institucional @unbosque.edu.co activo.',
        'Debes ser mayor de 18 años y tener capacidad legal para aceptar estos términos.',
        'La información que entregas al registrarte debe ser veraz, completa y estar actualizada. Cada cuenta es personal e intransferible; eres responsable de proteger tu contraseña y de todo lo que ocurra desde tu cuenta.',
      ],
    },
    {
      titulo: '3. Alcance del servicio',
      parrafos: [
        'Los viajes solo pueden publicarse dentro del área metropolitana de Bogotá y, según las reglas vigentes de la aplicación, cada viaje tiene como origen o destino la Universidad El Bosque.',
        'El conductor define el origen, el destino, la hora de salida, los cupos disponibles y el aporte por pasajero. El pasajero puede reservar un cupo y cancelarlo hasta 30 minutos antes de la hora de salida; pasado ese límite la reserva ya no puede cancelarse desde la aplicación.',
        'Los Desarrolladores pueden modificar, suspender o retirar funciones de la aplicación en cualquier momento.',
      ],
    },
    {
      titulo: '4. Aportes y costos compartidos',
      parrafos: [
        'El aporte por pasajero es una contribución voluntaria para compartir los gastos del trayecto (combustible, peajes, desgaste). No es el pago de un servicio de transporte y el conductor no debe usar la aplicación como actividad comercial ni para obtener lucro.',
        'El valor sugerido por la aplicación es solo una referencia. El conductor puede ofrecer el viaje sin costo, y el aporte nunca podrá superar el máximo que establezca la aplicación.',
        'WheelTrees no procesa, retiene ni garantiza pagos: el aporte se acuerda y se entrega directamente entre conductor y pasajero.',
      ],
    },
    {
      titulo: '5. Obligaciones del conductor',
      parrafos: [
        'Contar con licencia de conducción vigente y apta para la categoría del vehículo, y conducir respetando el Código Nacional de Tránsito (Ley 769 de 2002) y demás normas aplicables.',
        'Registrar únicamente vehículos de los que puede disponer legítimamente y declarar que tienen todos sus documentos al día: SOAT vigente, revisión técnico-mecánica y de emisiones cuando la ley la exija, y tarjeta de propiedad. Los documentos que cargues deben ser auténticos y legibles.',
        'Mantener el vehículo en buen estado mecánico y de seguridad; no exceder la capacidad registrada (las motos transportan un solo pasajero) y exigir el uso del casco y de los elementos de seguridad que la ley requiera.',
        'No conducir bajo los efectos del alcohol, drogas o medicamentos que afecten la conducción, ni usar el celular mientras conduce.',
        'Cumplir la hora, el recorrido y el punto de encuentro publicados, y avisar oportunamente cualquier cambio o cancelación.',
        'Los vehículos registrados quedan en estado pendiente hasta que un administrador los revise; el administrador puede aprobarlos o rechazarlos indicando el motivo.',
      ],
    },
    {
      titulo: '6. Obligaciones del pasajero',
      parrafos: [
        'Presentarse puntualmente en el punto de encuentro y respetar las instrucciones de seguridad del conductor.',
        'Usar el código de verificación de abordaje únicamente con el conductor del viaje que reservó.',
        'Tratar con respeto al conductor, al vehículo y a los demás pasajeros, y cancelar con anticipación cuando no pueda asistir.',
      ],
    },
    {
      titulo: '7. Conducta prohibida',
      parrafos: [
        'Está prohibido: suplantar la identidad de otra persona; entregar información o documentos falsos; acosar, discriminar, amenazar o agredir a otros usuarios; usar la aplicación con fines comerciales, ilícitos o diferentes al carpooling; interferir con el funcionamiento de la aplicación o intentar acceder a datos de otros usuarios; y publicar viajes fuera del área metropolitana de Bogotá.',
        'Los Desarrolladores pueden suspender o bloquear de forma temporal o definitiva las cuentas que incumplan estos términos, sin perjuicio de las acciones legales que correspondan.',
      ],
    },
    {
      titulo: '8. Seguridad, ubicación en vivo y reportes',
      parrafos: [
        'Para fortalecer la seguridad, durante un viaje en curso la aplicación comparte la ubicación del vehículo con los participantes de ese viaje. Puedes ver y administrar el permiso de ubicación desde tu dispositivo.',
        'La aplicación incluye un código de verificación de abordaje, calificaciones entre usuarios, un chat del viaje y un canal de ayuda para enviar comentarios o reportes sobre un viaje o un usuario. Los reportes los revisa un administrador y pueden derivar en la suspensión de cuentas.',
        'Estas herramientas ayudan a reducir riesgos, pero no los eliminan. Usa tu criterio: si sientes que una situación no es segura, no abordes o baja del vehículo en un lugar seguro y contacta a las autoridades (línea 123 en Colombia).',
      ],
    },
    {
      titulo: '9. Tratamiento de datos personales',
      parrafos: [
        'Tratamos tus datos conforme a la Ley 1581 de 2012, el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015) y demás normas de protección de datos personales de Colombia.',
        'Datos que recolectamos: nombre y correo institucional; direcciones guardadas de casa y trabajo (si las registras); ubicación del dispositivo y del vehículo durante los viajes; datos del vehículo (placa, marca, modelo, año, color, capacidad); número de cédula del propietario y fotografías de la licencia de conducción y de la tarjeta de propiedad; viajes, reservas, calificaciones, mensajes del chat y reportes.',
        'Finalidades: crear y administrar tu cuenta, conectar conductores y pasajeros, verificar vehículos y documentos, mostrar rutas y ubicación en vivo, mantener la seguridad de la comunidad, atender reportes y mejorar la aplicación. No vendemos tus datos.',
        'Datos biométricos: si activas el ingreso con huella o reconocimiento facial, la verificación la realiza el sistema operativo de tu dispositivo. WheelTrees no recibe ni almacena tu huella ni tu rostro; solo guarda en tu dispositivo, de forma protegida, la preferencia de usar ese método. Los datos biométricos son datos sensibles y su uso es siempre opcional.',
        'Documentos del conductor y del vehículo: las fotografías de la licencia de conducción y de la tarjeta de propiedad se recolectan únicamente para verificar que puedes conducir y que el vehículo puede ser registrado en la plataforma. Estos documentos pueden contener datos sensibles, como el grupo sanguíneo (RH) que aparece en la licencia. Por ser datos sensibles, no estás obligado a entregarlos; sin embargo, sin ellos no es posible aprobar tu registro como conductor. Los tratamos solo con tu autorización previa, expresa e informada, que otorgas en una casilla separada del formulario de registro de vehículos.',
        'Quién ve esos documentos: solo los administradores de WheelTrees, para revisar y aprobar o rechazar el vehículo. No se muestran a otros usuarios. Se conservan mientras el vehículo esté registrado y se eliminan cuando lo pidas, salvo que exista un deber legal de conservarlos. Si la tarjeta de propiedad pertenece a otra persona, declaras que cuentas con su autorización para compartir sus datos con WheelTrees. Puedes revocar tu autorización y solicitar la eliminación de los documentos escribiendo a ' + CORREO_CONTACTO + '. En ese caso el vehículo dejará de estar habilitado para publicar viajes.',
        'Servicios de terceros: para mapas, búsqueda de lugares y rutas usamos Google Maps Platform, y para alojar la información usamos infraestructura en la nube. Esa infraestructura puede estar ubicada fuera de Colombia, por lo que tus datos pueden ser transferidos y almacenados en otros países, aplicando medidas de seguridad adecuadas. Estos proveedores tratan los datos según sus propias políticas.',
        'Tus derechos como titular: conocer, actualizar y rectificar tus datos; solicitar prueba de la autorización; ser informado del uso que se les da; presentar quejas ante la Superintendencia de Industria y Comercio; revocar la autorización y solicitar la supresión de tus datos cuando no exista un deber legal o contractual de conservarlos; y acceder gratuitamente a ellos. Puedes ejercerlos escribiendo a ' + CORREO_CONTACTO + '.',
        'Aplicamos medidas técnicas y administrativas razonables (comunicaciones cifradas, control de acceso y almacenamiento protegido de credenciales) para proteger tu información. Ningún sistema es completamente infalible; si detectamos un incidente que te afecte, te lo informaremos.',
        'Conservamos tus datos mientras tengas una cuenta activa y durante el tiempo necesario para cumplir obligaciones legales o resolver reportes.',
      ],
    },
    {
      titulo: '10. Responsabilidad',
      parrafos: [
        'Cada usuario responde por sus actos y por el cumplimiento de la ley. Como WheelTrees solo intermedia entre personas, los Desarrolladores no son responsables por la conducta de conductores o pasajeros, por accidentes, daños, pérdidas, retrasos, cancelaciones o por la veracidad de la información que los usuarios publican, dentro de los límites que permita la ley.',
        'Las coberturas de seguros (como el SOAT) son las propias de cada vehículo y de cada persona; WheelTrees no ofrece seguros adicionales.',
        'Los Desarrolladores no garantizan que la aplicación funcione sin interrupciones ni errores, ni que siempre haya viajes disponibles.',
        'Nada de lo anterior limita derechos que la ley colombiana reconoce a los usuarios y que no puedan renunciarse.',
      ],
    },
    {
      titulo: '11. Propiedad intelectual',
      parrafos: [
        'La aplicación, su diseño, marca y código pertenecen a sus Desarrolladores. Se te concede un derecho personal, limitado y revocable para usarla conforme a estos términos. El contenido que publiques sigue siendo tuyo, pero nos autorizas a usarlo dentro de la aplicación para prestar el servicio.',
      ],
    },
    {
      titulo: '12. Cambios a estos términos',
      parrafos: [
        'Podemos actualizar estos términos. Cuando haya cambios importantes te lo informaremos en la aplicación o por correo, y la versión vigente siempre estará disponible desde el enlace de "términos y condiciones". Si sigues usando WheelTrees después de un cambio, entendemos que lo aceptas.',
      ],
    },
    {
      titulo: '13. Ley aplicable y contacto',
      parrafos: [
        'Estos términos se rigen por las leyes de la República de Colombia. Las diferencias se intentarán resolver primero de manera directa y, si no es posible, ante los jueces competentes de Bogotá D.C.',
        'Para dudas, solicitudes sobre tus datos o reportes, escríbenos a ' + CORREO_CONTACTO + ' o usa la sección de Ayuda de la aplicación.',
      ],
    },
  ],
  cierre:
    'Al marcar la casilla de aceptación y enviar el formulario, confirmas que leíste, entendiste y aceptas estos Términos y Condiciones y el tratamiento de tus datos personales descrito.',
};

const EN: Terminos = {
  titulo: 'WheelTrees Terms and Conditions of Use',
  version: TERMINOS_VERSION,
  actualizado: `Last updated: ${TERMINOS_FECHA_EN}`,
  intro:
    'Please read these Terms and Conditions carefully before using WheelTrees. By registering, publishing a trip, booking a seat or registering a vehicle, you state that you have read and accept them.',
  secciones: [
    {
      titulo: '1. What WheelTrees is',
      parrafos: [
        'WheelTrees is a carpooling mobile app for the Universidad El Bosque community. It connects people making the same trip within the Bogotá metropolitan area so they can share the vehicle and the trip costs.',
        'WheelTrees is an academic project developed as a degree thesis. The platform is a technology tool that connects users; it is not a transport company, does not provide transport services and does not own or operate the vehicles.',
        'In these terms, "the Developers" are the people who created and maintain WheelTrees, and "the User" is anyone who uses the app, as a driver or as a passenger.',
      ],
    },
    {
      titulo: '2. Who can use the app',
      parrafos: [
        'Only members of the university community with an active @unbosque.edu.co institutional email can register.',
        'You must be at least 18 years old and legally able to accept these terms.',
        'The information you provide must be truthful, complete and up to date. Each account is personal and non-transferable; you are responsible for keeping your password safe and for everything done from your account.',
      ],
    },
    {
      titulo: '3. Scope of the service',
      parrafos: [
        'Trips can only be published within the Bogotá metropolitan area and, under the app\'s current rules, every trip starts or ends at Universidad El Bosque.',
        'The driver sets the origin, destination, departure time, available seats and the contribution per passenger. Passengers can book a seat and cancel up to 30 minutes before departure; after that, the booking can no longer be cancelled from the app.',
        'The Developers may change, suspend or remove features of the app at any time.',
      ],
    },
    {
      titulo: '4. Contributions and shared costs',
      parrafos: [
        'The contribution per passenger is a voluntary amount to share trip expenses (fuel, tolls, wear). It is not payment for a transport service, and drivers must not use the app as a business or to make a profit.',
        'The amount suggested by the app is only a reference. Drivers may offer a trip for free, and the contribution can never exceed the maximum set by the app.',
        'WheelTrees does not process, hold or guarantee payments: the contribution is agreed and handed over directly between driver and passenger.',
      ],
    },
    {
      titulo: '5. Driver obligations',
      parrafos: [
        'Hold a valid driver\'s license for the vehicle category and drive in compliance with the Colombian Traffic Code (Law 769 of 2002) and other applicable rules.',
        'Register only vehicles you may legitimately use and declare that all their documents are up to date: valid SOAT insurance, technical and emissions inspection where required by law, and registration card. Uploaded documents must be authentic and legible.',
        'Keep the vehicle in good mechanical and safety condition; never exceed the registered capacity (motorcycles carry a single passenger) and require the helmet and safety equipment the law demands.',
        'Do not drive under the influence of alcohol, drugs or medication that impairs driving, and do not use the phone while driving.',
        'Follow the published time, route and meeting point, and give timely notice of any change or cancellation.',
        'Registered vehicles stay pending until an administrator reviews them; the administrator may approve or reject them, stating the reason.',
      ],
    },
    {
      titulo: '6. Passenger obligations',
      parrafos: [
        'Arrive on time at the meeting point and follow the driver\'s safety instructions.',
        'Share the boarding verification code only with the driver of the trip you booked.',
        'Treat the driver, the vehicle and other passengers with respect, and cancel in advance if you cannot attend.',
      ],
    },
    {
      titulo: '7. Prohibited conduct',
      parrafos: [
        'It is forbidden to: impersonate another person; provide false information or documents; harass, discriminate against, threaten or assault other users; use the app for commercial, unlawful or non-carpooling purposes; interfere with the app or try to access other users\' data; or publish trips outside the Bogotá metropolitan area.',
        'The Developers may temporarily or permanently suspend or block accounts that breach these terms, without prejudice to any legal action.',
      ],
    },
    {
      titulo: '8. Safety, live location and reports',
      parrafos: [
        'To strengthen safety, during a trip in progress the app shares the vehicle\'s location with that trip\'s participants. You can manage the location permission from your device.',
        'The app includes a boarding verification code, ratings between users, a trip chat and a help channel to send comments or reports about a trip or a user. Reports are reviewed by an administrator and may lead to account suspension.',
        'These tools help reduce risks but do not eliminate them. Use your judgment: if a situation feels unsafe, do not board or leave the vehicle at a safe place and contact the authorities (dial 123 in Colombia).',
      ],
    },
    {
      titulo: '9. Personal data processing',
      parrafos: [
        'We process your data under Law 1581 of 2012, Decree 1377 of 2013 (compiled in Decree 1074 of 2015) and other Colombian data protection rules.',
        'Data we collect: name and institutional email; saved home and work addresses (if you add them); device and vehicle location during trips; vehicle data (plate, make, model, year, color, capacity); the owner\'s ID number and photos of the driver\'s license and registration card; trips, bookings, ratings, chat messages and reports.',
        'Purposes: create and manage your account, connect drivers and passengers, verify vehicles and documents, show routes and live location, keep the community safe, handle reports and improve the app. We do not sell your data.',
        'Biometric data: if you enable fingerprint or face login, the check is performed by your device\'s operating system. WheelTrees does not receive or store your fingerprint or face; it only keeps, protected on your device, your preference to use that method. Biometric data is sensitive data and its use is always optional.',
        'Driver and vehicle documents: photos of the driver\'s license and the registration card are collected only to verify that you may drive and that the vehicle can be registered on the platform. These documents may contain sensitive data, such as the blood type (RH) shown on the license. Because the data is sensitive, you are not obliged to provide it; however, without it your driver registration cannot be approved. We process it only with your prior, express and informed authorization, which you give through a separate checkbox on the vehicle registration form.',
        'Who sees those documents: only WheelTrees administrators, to review and approve or reject the vehicle. They are not shown to other users. They are kept while the vehicle is registered and deleted on your request, unless there is a legal duty to keep them. If the registration card belongs to someone else, you declare that you have their authorization to share their data with WheelTrees. You may revoke your authorization and request deletion of the documents by writing to ' + CORREO_CONTACTO + '. In that case the vehicle will no longer be allowed to publish trips.',
        'Third-party services: we use Google Maps Platform for maps, place search and routes, and cloud infrastructure to host information. That infrastructure may be located outside Colombia, so your data may be transferred to and stored in other countries, with adequate security measures. These providers process data under their own policies.',
        'Your rights as a data subject: know, update and correct your data; request proof of your authorization; be informed of how your data is used; file complaints with the Superintendence of Industry and Commerce; revoke your authorization and request deletion where there is no legal or contractual duty to keep the data; and access it free of charge. You can exercise them by writing to ' + CORREO_CONTACTO + '.',
        'We apply reasonable technical and administrative measures (encrypted communications, access control and protected credential storage) to protect your information. No system is completely infallible; if we detect an incident affecting you, we will let you know.',
        'We keep your data while your account is active and for as long as needed to meet legal obligations or resolve reports.',
      ],
    },
    {
      titulo: '10. Liability',
      parrafos: [
        'Each user is responsible for their own actions and for complying with the law. Since WheelTrees only connects people, the Developers are not liable, within the limits allowed by law, for the conduct of drivers or passengers, accidents, damages, losses, delays, cancellations, or the accuracy of information users publish.',
        'Insurance coverage (such as SOAT) belongs to each vehicle and person; WheelTrees offers no additional insurance.',
        'The Developers do not guarantee that the app will work without interruptions or errors, or that trips will always be available.',
        'Nothing above limits rights that Colombian law grants to users and that cannot be waived.',
      ],
    },
    {
      titulo: '11. Intellectual property',
      parrafos: [
        'The app, its design, brand and code belong to its Developers. You are granted a personal, limited, revocable right to use it under these terms. Content you publish remains yours, but you authorize us to use it inside the app to provide the service.',
      ],
    },
    {
      titulo: '12. Changes to these terms',
      parrafos: [
        'We may update these terms. For important changes we will notify you in the app or by email, and the current version will always be available from the "terms and conditions" link. If you keep using WheelTrees after a change, we understand you accept it.',
      ],
    },
    {
      titulo: '13. Governing law and contact',
      parrafos: [
        'These terms are governed by the laws of the Republic of Colombia. Disputes will first be settled directly and, if that is not possible, before the competent courts of Bogotá D.C.',
        'For questions, data requests or reports, write to ' + CORREO_CONTACTO + ' or use the Help section of the app.',
      ],
    },
  ],
  cierre:
    'By ticking the acceptance box and submitting the form, you confirm that you have read, understood and accept these Terms and Conditions and the processing of your personal data described above.',
};

export function getTerminos(idioma: string = 'es'): Terminos {
  return idioma.toLowerCase().startsWith('en') ? EN : ES;
}

/** Texto plano completo (para el correo). */
export function terminosComoTexto(idioma: string = 'es'): string {
  const t = getTerminos(idioma);
  const bloques = [
    t.titulo,
    `${t.actualizado} · v${t.version}`,
    t.intro,
    ...t.secciones.map((s) => [s.titulo, ...s.parrafos].join('\n\n')),
    t.cierre,
  ];
  return bloques.join('\n\n');
}
