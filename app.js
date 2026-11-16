import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const $ = (id) => document.getElementById(id);
const modal = $("authModal");
const form = $("authForm");
const feedback = $("authFeedback");
const toast = $("toast");
let mode = "login";
let supabase = null;
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}
function setFeedback(message, isError = false) {
  feedback.textContent = message;
  feedback.dataset.error = String(isError);
}
function configReady() {
  return SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("TU-PROYECTO") &&
    SUPABASE_ANON_KEY.length > 30 &&
    !SUPABASE_ANON_KEY.includes("TU_SUPABASE");
}
function openAuth(nextMode) {
  setMode(nextMode);
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  $("email").focus();
}
function closeAuth() {
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  form.reset();
  setFeedback("");
}
function setMode(nextMode) {
  mode = nextMode;
  const registering = mode === "register";
  $("authTitle").innerHTML = registering ? "CREA TU<br><span>CUENTA.</span>" : "ENTRA EN<br><span>LA PARTIDA.</span>";
  $("authIntro").textContent = registering
    ? "Regístrate con tu correo. Te enviaremos un enlace de confirmación si está habilitado."
    : "Usa tu correo y contraseña para acceder.";
  $("nameField").hidden = !registering;
  $("registerName").required = registering;
  $("password").autocomplete = registering ? "new-password" : "current-password";
  $("authSubmit").textContent = registering ? "Crear cuenta ↗" : "Iniciar sesión ↗";
  $("switchAuth").textContent = registering ? "¿Ya tienes cuenta? Iniciar sesión" : "¿No tienes cuenta? Crear una";
  setFeedback("");
}
function showSignedOut() {
  $("loggedOut").hidden = false;
  $("loggedIn").hidden = true;
  $("authActions").innerHTML = '<button class="btn btn-outline" data-open-auth="login">Iniciar sesión</button><button class="btn btn-primary" data-open-auth="register">Crear cuenta ↗</button>';
  bindAuthButtons();
}
function showSignedIn(user, profile) {
  $("loggedOut").hidden = true;
  $("loggedIn").hidden = false;
  const displayName = profile?.display_name || user.user_metadata?.display_name || user.email?.split("@")[0] || "Jugador";
  $("profileName").textContent = displayName;
  $("profileEmail").textContent = user.email || "";
  $("displayName").value = profile?.display_name || "";
  $("phone").value = profile?.phone || "";
  $("avatarLetter").textContent = displayName.trim().charAt(0).toUpperCase() || "S";
  const isAdmin = profile?.role === "admin";
  $("roleChip").textContent = isAdmin ? "ADMINISTRADOR" : "CLIENTE";
  $("adminNotice").hidden = !isAdmin;
  $("authActions").innerHTML = '<span class="signed-in-label">Hola, ' + escapeHtml(displayName) + '</span><button class="btn btn-outline" id="headerSignOut">Salir</button>';
  $("headerSignOut").addEventListener("click", signOut);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}
async function loadProfile(user) {
  const { data, error } = await supabase.from("profiles")
    .select("id, display_name, phone, role, created_at")
    .eq("id", user.id).maybeSingle();
  if (error) {
    console.error("No se pudo cargar el perfil:", error);
    showSignedIn(user, null);
    $("profileNotice").textContent = "La sesión está activa, pero no se pudo leer el perfil. Comprueba que ejecutaste el SQL de la etapa 2 y sus políticas RLS.";
    return;
  }
  showSignedIn(user, data);
}
async function refreshSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) console.error(error);
  if (data.session?.user) await loadProfile(data.session.user);
  else showSignedOut();
}
async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) showToast("No se pudo cerrar sesión: " + error.message);
  else { showSignedOut(); showToast("Sesión cerrada."); }
}
function bindAuthButtons() {
  // Delegación: sigue funcionando aunque el encabezado cambie tras iniciar/cerrar sesión.
}
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-auth]");
  if (button) openAuth(button.dataset.openAuth);
});
async function handleAuth(event) {
  event.preventDefault();
  if (!supabase) return setFeedback("Primero configura config.js con la URL y la clave pública de Supabase.", true);
  const email = $("email").value.trim();
  const password = $("password").value;
  const submit = $("authSubmit");
  submit.disabled = true;
  setFeedback(mode === "register" ? "Creando tu cuenta..." : "Iniciando sesión...");
  try {
    if (mode === "register") {
      const display_name = $("registerName").value.trim();
      if (display_name.length < 2) throw new Error("Escribe un nombre de al menos 2 caracteres.");
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { data: { display_name } }
      });
      if (error) throw error;
      if (data.session) {
        await refreshSession();
        closeAuth();
        showToast("Cuenta creada. ¡Bienvenido a SHADOW SHOP!");
      } else {
        setFeedback("Registro recibido. Revisa tu correo y confirma la cuenta antes de iniciar sesión.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await refreshSession();
      closeAuth();
      showToast("¡Bienvenido de vuelta!");
    }
  } catch (error) {
    setFeedback(error.message || "No se pudo completar la operación.", true);
  } finally {
    submit.disabled = false;
  }
}
async function saveProfile() {
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return showToast("Tu sesión expiró. Inicia sesión de nuevo.");
  const display_name = $("displayName").value.trim();
  const phone = $("phone").value.trim() || null;
  if (display_name.length < 2) return showToast("El nombre debe tener al menos 2 caracteres.");
  const { error } = await supabase.from("profiles")
    .update({ display_name, phone }).eq("id", user.id);
  if (error) return showToast("No se pudo guardar: " + error.message);
  await loadProfile(user);
  showToast("Perfil actualizado.");
}

$("year").textContent = new Date().getFullYear();
$("closeAuth").addEventListener("click", closeAuth);
$("switchAuth").addEventListener("click", () => setMode(mode === "login" ? "register" : "login"));
modal.addEventListener("click", (event) => { if (event.target === modal) closeAuth(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeAuth(); });
form.addEventListener("submit", handleAuth);
$("saveProfile").addEventListener("click", saveProfile);
$("signOut").addEventListener("click", signOut);
$("mobileMenu").addEventListener("click", () => showToast("Usa los accesos de la navegación para explorar."));
document.querySelectorAll("[data-coming]").forEach((button) => button.addEventListener("click", () => showToast(`${button.dataset.coming}: el catálogo se conectará en la etapa 3.`)));
bindAuthButtons();

if (!configReady()) {
  showSignedOut();
  console.warn("Configura config.js con las credenciales públicas de tu proyecto Supabase.");
} else {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    // Evita operaciones async dentro del callback síncrono de Auth.
    setTimeout(() => session?.user ? loadProfile(session.user) : showSignedOut(), 0);
  });
  refreshSession();
}
