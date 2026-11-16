# SHADOW SHOP — Etapa 2: autenticación, perfiles y roles

Esta entrega conecta el frontend de la etapa 1 con **Supabase Auth** y una tabla `profiles` protegida por Row Level Security (RLS).

## Qué incluye

- Registro por correo y contraseña.
- Inicio y cierre de sesión.
- Persistencia y renovación de sesión con Supabase Auth.
- Confirmación de correo compatible con el ajuste del proyecto Supabase.
- Creación automática del perfil al registrar una cuenta.
- Edición del nombre visible y teléfono.
- Roles `customer` y `admin`.
- Indicador de administrador en la interfaz.
- Políticas RLS para que cada cliente consulte y edite únicamente su propio perfil.
- La columna `role` no es editable desde el navegador.
- El rol administrador se asigna manualmente desde el SQL Editor.

## Qué NO incluye todavía

No hay pagos, saldo, depósitos, comprobantes, pedidos reales, WhatsApp, API de proveedor, referidos, sorteos ni alcancía. Tampoco se ha creado un panel administrativo operativo. Esos módulos pertenecen a etapas posteriores y requieren backend y controles transaccionales. El frontend no inventa saldos ni confirma pagos.

## 1. Crear el proyecto Supabase

1. Crea una cuenta en https://supabase.com/ y crea un proyecto.
2. Guarda la contraseña de base de datos en un gestor seguro.
3. En el panel del proyecto, abre **Project Settings → API** (o la sección de API Keys).
4. Copia la **Project URL** y la clave pública **anon/publishable**.
5. Nunca copies la clave `service_role` al navegador, a GitHub ni a `config.js`.

## 2. Crear las tablas y políticas

1. Abre **SQL Editor → New query**.
2. Copia y ejecuta el contenido completo de `supabase-stage2.sql`.
3. Comprueba en **Table Editor** que existe `public.profiles`.
4. En **Authentication → Users**, registra una cuenta de prueba y confirma el correo si la confirmación está activada.
5. Comprueba que el trigger creó un perfil correspondiente en `public.profiles`.

El script crea el perfil automáticamente y activa RLS. La concesión SQL permite actualizar solo `display_name` y `phone`; no concede permisos para modificar `role`.

## 3. Configurar el frontend

1. Copia `config.example.js` y renombra la copia a `config.js`.
2. Edita `config.js`:

```js
export const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
export const SUPABASE_ANON_KEY = "TU_CLAVE_PUBLICA_ANON_O_PUBLISHABLE";
```

3. Guarda el archivo. `config.js` está incluido en `.gitignore` para evitar subir la configuración local por accidente.
4. No pongas secretos de servidor en este archivo. La clave pública de Supabase está diseñada para usarse en el cliente cuando RLS está correctamente configurado.

## 4. Configurar URLs de autenticación

En Supabase abre **Authentication → URL Configuration**:

- Site URL: la URL de tu sitio publicado.
- Redirect URLs: añade la URL local que uses para pruebas y la URL de producción, por ejemplo `http://localhost:5500/**` y `https://TU-SITIO.vercel.app/**`.

Los nombres exactos de los menús pueden variar según la versión del panel. Para pruebas locales usa un servidor local, no abras `index.html` directamente con `file://`.

Si quieres exigir confirmación de correo, deja activada la opción de confirmación en Authentication. El usuario deberá verificar su correo antes de poder iniciar sesión, dependiendo de la configuración de Auth y del proveedor de correo.

## 5. Probar en tu computadora

Puedes usar VS Code con la extensión Live Server o cualquier servidor estático local.

Ejemplo con Python desde la carpeta del proyecto:

```bash
python -m http.server 5500
```

Después abre `http://localhost:5500`.

Pruebas recomendadas:

1. Registra un usuario de prueba.
2. Confirma el correo si se solicita.
3. Inicia sesión.
4. Comprueba que aparece el perfil y el correo.
5. Cambia nombre y teléfono y guarda.
6. Cierra sesión y vuelve a entrar.
7. Comprueba que el perfil persiste.
8. Registra otro usuario y verifica que no puede consultar el perfil del primero.

## 6. Crear tu primer administrador

Primero registra tu propia cuenta desde la web y confirma el correo. Después, desde **Supabase → SQL Editor**, ejecuta la siguiente consulta sustituyendo el correo:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users
  where email = 'TU_CORREO_DE_ADMIN'
);
```

Verifica el resultado:

```sql
select u.email, p.display_name, p.role
from public.profiles p
join auth.users u on u.id = p.id
where u.email = 'TU_CORREO_DE_ADMIN';
```

No agregues una función de promoción de rol en el frontend. La asignación debe quedar restringida al propietario/administrador del proyecto mediante el SQL Editor o un backend administrativo confiable.

## 7. Publicar gratis inicialmente

Una ruta sencilla es GitHub + Vercel + Supabase:

1. Crea un repositorio privado en GitHub.
2. Sube los archivos del proyecto excepto `config.js`.
3. En Vercel, importa el repositorio.
4. Configura el proyecto como sitio estático. No requiere comando de build; el directorio de salida es la raíz del repositorio.
5. Para desplegar, crea `config.js` durante el desarrollo local o adapta posteriormente la carga de configuración a variables públicas de build. **No subas secretos.**
6. Añade el dominio `*.vercel.app` a las Redirect URLs de Supabase.

Para una publicación reproducible sin subir `config.js`, la próxima iteración puede leer la URL y la clave pública desde variables de entorno del proceso de build. Son valores públicos; cualquier clave secreta sigue siendo exclusivamente del servidor.

## Seguridad importante

- Activa y conserva RLS en todas las tablas que expongas por la API de Supabase.
- Nunca uses `service_role` en HTML, JavaScript del navegador, repositorios o capturas.
- No confíes en el rol enviado por el navegador.
- El saldo, los movimientos y los estados de pago no deben ser actualizados directamente por clientes.
- En las próximas etapas, las operaciones monetarias deben ejecutarse en funciones backend/transacciones protegidas y guardar un libro de movimientos inmutable.
- Configura límites de autenticación, protección antiabuso, backups y políticas de almacenamiento antes de operar con clientes reales.

## Archivos

- `index.html`: interfaz de la etapa 2.
- `styles.css`: estilos base de la etapa 1.
- `auth.css`: estilos de formularios, perfil y estados.
- `app.js`: integración de Supabase Auth y perfiles.
- `config.example.js`: plantilla de configuración.
- `config.js`: configuración local con marcadores; reemplázala y no la publiques.
- `supabase-stage2.sql`: tabla, trigger, función de rol, grants y políticas RLS.
- `.gitignore`: excluye la configuración local.

## Compatibilidad

`app.js` usa `@supabase/supabase-js` v2 desde CDN como módulo ES. Necesita conexión a Internet y un servidor HTTP/HTTPS. Para una aplicación de producción se recomienda fijar una versión probada y, posteriormente, integrar el cliente como dependencia del proceso de build.
