/* Semanario Familiar — lógica principal */

const STORAGE_KEY  = "semanario.v1";
const SYNC_KEY     = "semanario.sync";
const DIAS_SEMANA     = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const DIAS_SEMANA_KEY = ["lunes", "martes", "miercoles",  "jueves", "viernes", "sabado",  "domingo"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
               "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/* ─── Estado ─── */
let estado = cargarEstado();
let semanaActiva = lunesDeFecha(new Date());   // siempre apunta a un lunes
let editando = null;                            // fecha "YYYY-MM-DD" en edición
let syncSha = null;                             // sha del último fichero leído de GitHub
let syncTimer = null;                           // debounce para guardar en nube
let syncEstado = "idle";                        // idle | syncing | synced | error | local

/* ─── Persistencia ─── */
function cargarEstado() {
    try {
        const guardado = localStorage.getItem(STORAGE_KEY);
        if (guardado) return migrar(JSON.parse(guardado));
    } catch (e) {
        console.warn("Datos en localStorage corruptos, usando iniciales", e);
    }
    return clonar(DATOS_INICIALES);
}
function guardarLocal() {
    estado.actualizadoEn = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
}
function guardarEstado() {
    guardarLocal();
    guardarEnNubeDebounced();
}
function clonar(obj) { return JSON.parse(JSON.stringify(obj)); }

// Asegura compatibilidad con datos antiguos (sin recurrentes/excepciones).
function migrar(datos) {
    if (!datos.eventosRecurrentes) {
        datos.eventosRecurrentes = clonar(DATOS_INICIALES.eventosRecurrentes);
    }
    if (!datos.excepciones) datos.excepciones = {};
    DIAS_SEMANA_KEY.forEach(k => {
        if (!Array.isArray(datos.eventosRecurrentes[k])) datos.eventosRecurrentes[k] = [];
    });
    return datos;
}

/* ─── Utilidades de fecha ─── */
function lunesDeFecha(fecha) {
    const d = new Date(fecha);
    d.setHours(0, 0, 0, 0);
    const dia = d.getDay();                  // 0 dom, 1 lun, ..., 6 sab
    const offset = dia === 0 ? -6 : 1 - dia; // lleva a lunes
    d.setDate(d.getDate() + offset);
    return d;
}
function sumarDias(fecha, n) {
    const d = new Date(fecha);
    d.setDate(d.getDate() + n);
    return d;
}
function isoFecha(fecha) {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, "0");
    const d = String(fecha.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}
function mismaFecha(a, b) { return isoFecha(a) === isoFecha(b); }
function indiceDiaSemana(fecha) {            // 0 lunes ... 6 domingo
    const d = fecha.getDay();
    return d === 0 ? 6 : d - 1;
}

/* ─── Lógica de eventos ─── */
function mismoEvento(a, b) {
    return a.persona === b.persona && a.hora === b.hora && a.titulo === b.titulo;
}

// Devuelve la lista combinada de eventos para un día:
// puntuales + recurrentes activos (descontando excepciones).
function eventosDelDia(fecha) {
    const iso = isoFecha(fecha);
    const puntuales = (estado.semana[iso]?.eventos || [])
        .map(e => ({ ...e, recurrente: false }));

    const keyDia = DIAS_SEMANA_KEY[indiceDiaSemana(fecha)];
    const recurrentes = estado.eventosRecurrentes[keyDia] || [];
    const canceladosHoy = estado.excepciones[iso] || [];
    const recurrentesActivos = recurrentes
        .filter(rec => !canceladosHoy.some(c => mismoEvento(c, rec)))
        .map(rec => ({ ...rec, recurrente: true }));

    return [...puntuales, ...recurrentesActivos];
}

/* ─── Render ─── */
function renderLeyenda() {
    const c = document.getElementById("legend");
    c.innerHTML = "";
    estado.familia.forEach(p => {
        const span = document.createElement("span");
        span.className = "legend-item";
        span.style.background = p.color;
        span.textContent = p.nombre;
        c.appendChild(span);
    });
}

function renderSubtitulo() {
    const ini = semanaActiva;
    const fin = sumarDias(ini, 6);
    const mismoMes = ini.getMonth() === fin.getMonth();
    const txt = mismoMes
        ? `Semana del ${ini.getDate()} al ${fin.getDate()} de ${MESES[fin.getMonth()]} ${fin.getFullYear()}`
        : `Semana del ${ini.getDate()} ${MESES[ini.getMonth()]} al ${fin.getDate()} ${MESES[fin.getMonth()]} ${fin.getFullYear()}`;
    document.getElementById("weekSubtitle").textContent = txt;
}

function renderSemana() {
    const grid = document.getElementById("weekGrid");
    grid.innerHTML = "";
    const hoy = new Date();

    for (let i = 0; i < 7; i++) {
        const fecha = sumarDias(semanaActiva, i);
        const iso = isoFecha(fecha);
        const datos = estado.semana[iso] || { comida: "", cena: "" };

        const card = document.createElement("article");
        card.className = "day-card";
        if (mismaFecha(fecha, hoy)) card.classList.add("today");
        card.dataset.fecha = iso;
        card.addEventListener("click", () => abrirEditor(iso));

        // Cabecera
        const head = document.createElement("div");
        head.className = "day-head";
        const nombre = document.createElement("span");
        nombre.className = "day-name";
        nombre.textContent = DIAS_SEMANA[i];
        const num = document.createElement("span");
        num.className = "day-date";
        num.textContent = `${fecha.getDate()} ${MESES[fecha.getMonth()].slice(0, 3)}`;
        head.append(nombre, num);

        // Comidas
        const meals = document.createElement("div");
        meals.className = "meals";
        meals.append(
            crearMeal("🥗", datos.comida, "Sin comida"),
            crearMeal("🌙", datos.cena,   "Sin cena")
        );

        // Eventos
        const events = document.createElement("div");
        events.className = "events";
        const evTitle = document.createElement("div");
        evTitle.className = "events-title";
        evTitle.textContent = "Eventos";
        events.appendChild(evTitle);

        const lista = eventosDelDia(fecha);
        if (lista.length === 0) {
            const noEv = document.createElement("span");
            noEv.className = "no-events";
            noEv.textContent = "Sin eventos";
            events.appendChild(noEv);
        } else {
            lista.sort((a, b) => (a.hora || "").localeCompare(b.hora || ""))
                 .forEach(ev => events.appendChild(crearEvento(ev)));
        }

        card.append(head, meals, events);
        grid.appendChild(card);
    }
}

function crearMeal(emoji, valor, placeholder) {
    const wrap = document.createElement("div");
    wrap.className = "meal";
    const lab = document.createElement("span");
    lab.className = "meal-label";
    lab.textContent = emoji;
    const val = document.createElement("span");
    val.className = "meal-value" + (valor ? "" : " empty");
    val.textContent = valor || placeholder;
    wrap.append(lab, val);
    return wrap;
}

function crearEvento(ev) {
    const persona = estado.familia.find(p => p.id === ev.persona);
    const color = persona ? persona.color : "#e0e0e0";
    const pill = document.createElement("div");
    pill.className = "event-pill";
    pill.style.background = color;

    if (ev.recurrente) {
        const r = document.createElement("span");
        r.className = "event-recurring";
        r.textContent = "♻";
        r.title = "Evento recurrente";
        pill.appendChild(r);
    }
    if (ev.hora) {
        const h = document.createElement("span");
        h.className = "event-time";
        h.textContent = ev.hora;
        pill.appendChild(h);
    }
    if (persona) {
        const p = document.createElement("span");
        p.className = "event-person";
        p.textContent = persona.nombre.slice(0, 3);
        pill.appendChild(p);
    }
    const t = document.createElement("span");
    t.className = "event-title";
    t.textContent = ev.titulo || "(sin título)";
    pill.appendChild(t);
    return pill;
}

function render() {
    renderLeyenda();
    renderSubtitulo();
    renderSemana();
}

/* ─── Modal de edición del día ─── */
function abrirEditor(iso) {
    editando = iso;
    const datos = estado.semana[iso] || { comida: "", cena: "", eventos: [] };

    const [y, m, d] = iso.split("-").map(Number);
    const fecha = new Date(y, m - 1, d);
    document.getElementById("modalTitle").textContent =
        `${DIAS_SEMANA[indiceDiaSemana(fecha)]}, ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;

    document.getElementById("mealLunch").value  = datos.comida || "";
    document.getElementById("mealDinner").value = datos.cena   || "";

    // Recurrentes del día (con checkbox de cancelación)
    const keyDia = DIAS_SEMANA_KEY[indiceDiaSemana(fecha)];
    const recurrentes = estado.eventosRecurrentes[keyDia] || [];
    const cancelados = estado.excepciones[iso] || [];
    const recSection = document.getElementById("recurringDaySection");
    const recList = document.getElementById("recurringDayList");
    recList.innerHTML = "";
    if (recurrentes.length === 0) {
        recSection.hidden = true;
    } else {
        recSection.hidden = false;
        recurrentes.forEach(rec => {
            recList.appendChild(crearFilaRecurrenteDia(rec, cancelados));
        });
    }

    // Eventos puntuales
    const list = document.getElementById("eventsEditList");
    list.innerHTML = "";
    (datos.eventos || []).forEach(ev => list.appendChild(crearFilaEvento(ev)));

    document.getElementById("modalBackdrop").hidden = false;
}

function cerrarEditor() {
    editando = null;
    document.getElementById("modalBackdrop").hidden = true;
}

function crearFilaRecurrenteDia(rec, cancelados) {
    const persona = estado.familia.find(p => p.id === rec.persona);
    const li = document.createElement("li");
    li.className = "recurring-day-row";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !cancelados.some(c => mismoEvento(c, rec));
    cb.dataset.persona = rec.persona;
    cb.dataset.hora    = rec.hora;
    cb.dataset.titulo  = rec.titulo;

    const label = document.createElement("label");
    label.className = "recurring-day-label";
    label.style.background = persona ? persona.color : "#e0e0e0";

    const partes = [];
    if (rec.hora) partes.push(`<strong>${rec.hora}</strong>`);
    if (persona)  partes.push(`<span class="rec-person">${persona.nombre}</span>`);
    partes.push(rec.titulo);
    label.innerHTML = partes.join(" · ");

    const wrap = document.createElement("div");
    wrap.className = "recurring-day-wrap";
    wrap.append(cb, label);
    li.appendChild(wrap);
    return li;
}

function crearFilaEvento(ev = { persona: estado.familia[0].id, hora: "", titulo: "" }) {
    const li = document.createElement("li");
    li.className = "event-edit-row";

    const selPersona = document.createElement("select");
    estado.familia.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.nombre;
        if (p.id === ev.persona) opt.selected = true;
        selPersona.appendChild(opt);
    });

    const inHora = document.createElement("input");
    inHora.type = "time";
    inHora.value = ev.hora || "";

    const inTitulo = document.createElement("input");
    inTitulo.type = "text";
    inTitulo.placeholder = "Descripción del evento";
    inTitulo.value = ev.titulo || "";

    const btn = document.createElement("button");
    btn.className = "remove-event";
    btn.innerHTML = "×";
    btn.title = "Eliminar evento";
    btn.addEventListener("click", () => li.remove());

    li.append(selPersona, inHora, inTitulo, btn);
    return li;
}

function guardarEdicion() {
    if (!editando) return;
    const comida = document.getElementById("mealLunch").value.trim();
    const cena   = document.getElementById("mealDinner").value.trim();

    // Eventos puntuales
    const eventos = [...document.querySelectorAll("#eventsEditList .event-edit-row")]
        .map(row => {
            const [persona, hora, titulo] = row.querySelectorAll("select, input");
            return {
                persona: persona.value,
                hora: hora.value,
                titulo: titulo.value.trim()
            };
        })
        .filter(e => e.titulo);

    // Excepciones: recurrentes desmarcados para este día
    const cancelados = [];
    document.querySelectorAll("#recurringDayList input[type=checkbox]").forEach(cb => {
        if (!cb.checked) {
            cancelados.push({
                persona: cb.dataset.persona,
                hora:    cb.dataset.hora,
                titulo:  cb.dataset.titulo
            });
        }
    });
    if (cancelados.length === 0) {
        delete estado.excepciones[editando];
    } else {
        estado.excepciones[editando] = cancelados;
    }

    if (!comida && !cena && eventos.length === 0) {
        delete estado.semana[editando];
    } else {
        estado.semana[editando] = { comida, cena, eventos };
    }

    guardarEstado();
    cerrarEditor();
    render();
}

/* ─── Modal de gestión de eventos recurrentes ─── */
function abrirGestorRecurrentes() {
    const body = document.getElementById("recurringBody");
    body.innerHTML = "";

    DIAS_SEMANA.forEach((nombre, i) => {
        const key = DIAS_SEMANA_KEY[i];

        const section = document.createElement("section");
        section.className = "recurring-day-block";
        section.dataset.day = key;

        const head = document.createElement("div");
        head.className = "events-head";
        const h = document.createElement("h3");
        h.textContent = nombre;
        h.style.textTransform = "capitalize";
        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "add-btn";
        addBtn.textContent = "+ Añadir";
        head.append(h, addBtn);

        const list = document.createElement("ul");
        list.className = "events-edit-list";
        list.dataset.day = key;
        (estado.eventosRecurrentes[key] || []).forEach(ev => {
            list.appendChild(crearFilaEvento(ev));
        });
        addBtn.addEventListener("click", () => {
            list.appendChild(crearFilaEvento());
        });

        section.append(head, list);
        body.appendChild(section);
    });

    document.getElementById("recurringModal").hidden = false;
}

function cerrarGestorRecurrentes() {
    document.getElementById("recurringModal").hidden = true;
}

function guardarRecurrentes() {
    const nuevoRec = {};
    DIAS_SEMANA_KEY.forEach(key => {
        const list = document.querySelector(`#recurringBody ul[data-day="${key}"]`);
        if (!list) { nuevoRec[key] = []; return; }
        const eventos = [...list.querySelectorAll(".event-edit-row")]
            .map(row => {
                const [persona, hora, titulo] = row.querySelectorAll("select, input");
                return {
                    persona: persona.value,
                    hora: hora.value,
                    titulo: titulo.value.trim()
                };
            })
            .filter(e => e.titulo);
        nuevoRec[key] = eventos;
    });
    estado.eventosRecurrentes = nuevoRec;

    // Limpia excepciones huérfanas (que apunten a recurrentes ya inexistentes).
    Object.keys(estado.excepciones).forEach(fechaIso => {
        const [y, m, d] = fechaIso.split("-").map(Number);
        const keyDia = DIAS_SEMANA_KEY[indiceDiaSemana(new Date(y, m - 1, d))];
        const recs = nuevoRec[keyDia] || [];
        const filtradas = estado.excepciones[fechaIso].filter(exc =>
            recs.some(r => mismoEvento(r, exc))
        );
        if (filtradas.length === 0) delete estado.excepciones[fechaIso];
        else estado.excepciones[fechaIso] = filtradas;
    });

    guardarEstado();
    cerrarGestorRecurrentes();
    render();
}

/* ─── Importar / Exportar ─── */
function exportar() {
    const blob = new Blob([JSON.stringify(estado, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `semanario-${isoFecha(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importar(file) {
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const datos = JSON.parse(e.target.result);
            if (!datos.familia || !datos.semana) throw new Error("Formato inválido");
            estado = migrar(datos);
            guardarEstado();
            render();
        } catch (err) {
            alert("No se pudo leer el fichero: " + err.message);
        }
    };
    reader.readAsText(file);
}

function reset() {
    if (!confirm("¿Volver a los datos iniciales? Se perderán los cambios guardados.")) return;
    estado = clonar(DATOS_INICIALES);
    guardarEstado();
    render();
}

/* ─── Sincronización con GitHub ─── */
function getSyncConfig() {
    try {
        return JSON.parse(localStorage.getItem(SYNC_KEY)) || null;
    } catch { return null; }
}
function setSyncConfig(cfg) {
    if (cfg) localStorage.setItem(SYNC_KEY, JSON.stringify(cfg));
    else localStorage.removeItem(SYNC_KEY);
}
function ghUrl(cfg) {
    return `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${cfg.path.split("/").map(encodeURIComponent).join("/")}`;
}
function ghHeaders(cfg) {
    return {
        "Authorization": `Bearer ${cfg.token}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    };
}

// Codifica un string UTF-8 a base64 (soporta emojis y acentos).
function b64encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
}
function b64decode(b64) {
    return decodeURIComponent(escape(atob(b64.replace(/\n/g, ""))));
}

async function ghLeerFichero(cfg) {
    const url = `${ghUrl(cfg)}?ref=${encodeURIComponent(cfg.branch)}`;
    const res = await fetch(url, { headers: ghHeaders(cfg) });
    if (res.status === 404) return { existe: false };
    if (!res.ok) throw new Error(`GET ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const contenido = b64decode(data.content);
    return { existe: true, contenido, sha: data.sha };
}

async function ghEscribirFichero(cfg, contenido, sha, mensaje) {
    const body = {
        message: mensaje || `Update semanario ${isoFecha(new Date())} ${new Date().toLocaleTimeString("es-ES")}`,
        content: b64encode(contenido),
        branch: cfg.branch
    };
    if (sha) body.sha = sha;

    const res = await fetch(ghUrl(cfg), {
        method: "PUT",
        headers: { ...ghHeaders(cfg), "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`PUT ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.content.sha;
}

async function cargarDeNube() {
    const cfg = getSyncConfig();
    if (!cfg) { setSyncEstado("local"); return; }
    setSyncEstado("syncing");
    try {
        const r = await ghLeerFichero(cfg);
        if (!r.existe) { setSyncEstado("error", "Fichero no encontrado"); return; }
        const datos = JSON.parse(r.contenido);
        const localTs = estado.actualizadoEn || 0;
        const remotoTs = datos.actualizadoEn || 0;
        if (remotoTs >= localTs) {
            estado = migrar(datos);
            guardarLocal();
            render();
        } else {
            // Local es más reciente → lo subimos en cuanto guarde algo
            console.info("Local más reciente que remoto, no sobreescribimos.");
        }
        syncSha = r.sha;
        setSyncEstado("synced");
    } catch (e) {
        console.warn(e);
        setSyncEstado("error", e.message);
    }
}

function guardarEnNubeDebounced() {
    const cfg = getSyncConfig();
    if (!cfg) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(guardarEnNube, 600);
}

async function guardarEnNube() {
    const cfg = getSyncConfig();
    if (!cfg) return;
    setSyncEstado("syncing");
    try {
        const json = JSON.stringify(estado, null, 2);
        try {
            syncSha = await ghEscribirFichero(cfg, json, syncSha);
        } catch (e) {
            if (String(e.message).startsWith("PUT 409")) {
                // SHA obsoleto: alguien escribió antes. Recogemos y reintentamos UNA vez.
                const r = await ghLeerFichero(cfg);
                if (r.existe) syncSha = r.sha;
                syncSha = await ghEscribirFichero(cfg, json, syncSha);
            } else {
                throw e;
            }
        }
        setSyncEstado("synced");
    } catch (e) {
        console.warn(e);
        setSyncEstado("error", e.message);
    }
}

function setSyncEstado(s, detalle = "") {
    syncEstado = s;
    const icon = document.getElementById("syncIcon");
    const label = document.getElementById("syncLabel");
    if (!icon || !label) return;
    const map = {
        local:   { i: "💾", t: "Local",        title: "Sincronización desactivada" },
        idle:    { i: "💾", t: "Local",        title: "" },
        syncing: { i: "⌛", t: "Guardando…",   title: "" },
        synced:  { i: "☁️", t: "Sincronizado", title: "Datos al día con GitHub" },
        error:   { i: "⚠️", t: "Error",        title: detalle || "Error al sincronizar" }
    };
    const m = map[s] || map.idle;
    icon.textContent = m.i;
    label.textContent = m.t;
    document.getElementById("syncBtn").title = m.title;
}

/* ─── Modal de configuración de sync ─── */
function abrirConfigSync() {
    const cfg = getSyncConfig() || {};
    document.getElementById("ghToken").value  = cfg.token  || "";
    document.getElementById("ghOwner").value  = cfg.owner  || "";
    document.getElementById("ghRepo").value   = cfg.repo   || "";
    document.getElementById("ghPath").value   = cfg.path   || "datos.json";
    document.getElementById("ghBranch").value = cfg.branch || "main";
    setSyncMsg("");
    document.getElementById("syncModal").hidden = false;
}
function cerrarConfigSync() {
    document.getElementById("syncModal").hidden = true;
}
function leerConfigDelModal() {
    return {
        token:  document.getElementById("ghToken").value.trim(),
        owner:  document.getElementById("ghOwner").value.trim(),
        repo:   document.getElementById("ghRepo").value.trim(),
        path:   document.getElementById("ghPath").value.trim() || "datos.json",
        branch: document.getElementById("ghBranch").value.trim() || "main"
    };
}
function setSyncMsg(texto, tipo = "info") {
    const el = document.getElementById("syncStatusMsg");
    el.textContent = texto;
    el.className = "sync-status " + (texto ? tipo : "");
}

async function probarSync() {
    const cfg = leerConfigDelModal();
    if (!cfg.token || !cfg.owner || !cfg.repo) {
        setSyncMsg("Faltan datos (token, usuario o repo).", "error");
        return;
    }
    setSyncMsg("Comprobando…");
    try {
        const r = await ghLeerFichero(cfg);
        if (r.existe) setSyncMsg(`✓ Fichero encontrado (${r.contenido.length} bytes).`, "ok");
        else setSyncMsg("Conexión OK, pero el fichero aún no existe. Usa 'Inicializar fichero'.", "warn");
    } catch (e) {
        setSyncMsg("✗ " + e.message, "error");
    }
}

async function inicializarFichero() {
    const cfg = leerConfigDelModal();
    if (!cfg.token || !cfg.owner || !cfg.repo) {
        setSyncMsg("Faltan datos (token, usuario o repo).", "error");
        return;
    }
    setSyncMsg("Creando fichero…");
    try {
        const r = await ghLeerFichero(cfg);
        if (r.existe) {
            setSyncMsg("El fichero ya existe. Pulsa 'Guardar' para conectarlo.", "warn");
            return;
        }
        const json = JSON.stringify({ ...estado, actualizadoEn: Date.now() }, null, 2);
        await ghEscribirFichero(cfg, json, null, "Inicializar semanario");
        setSyncMsg("✓ Fichero creado. Ya puedes pulsar 'Guardar y sincronizar'.", "ok");
    } catch (e) {
        setSyncMsg("✗ " + e.message, "error");
    }
}

async function guardarConfigSync() {
    const cfg = leerConfigDelModal();
    if (!cfg.token || !cfg.owner || !cfg.repo) {
        setSyncMsg("Faltan datos (token, usuario o repo).", "error");
        return;
    }
    setSyncMsg("Conectando…");
    try {
        const r = await ghLeerFichero(cfg);
        if (!r.existe) {
            setSyncMsg("El fichero no existe. Usa 'Inicializar fichero' primero.", "error");
            return;
        }
        setSyncConfig(cfg);
        // Cargar contenido remoto si es más reciente
        const datos = JSON.parse(r.contenido);
        if ((datos.actualizadoEn || 0) >= (estado.actualizadoEn || 0)) {
            estado = migrar(datos);
            guardarLocal();
        } else {
            // Subimos lo local
            estado.actualizadoEn = Date.now();
            const json = JSON.stringify(estado, null, 2);
            await ghEscribirFichero(cfg, json, r.sha);
        }
        syncSha = r.sha;
        setSyncEstado("synced");
        cerrarConfigSync();
        render();
    } catch (e) {
        setSyncMsg("✗ " + e.message, "error");
    }
}

function desconectarSync() {
    if (!confirm("¿Desconectar la sincronización? Los datos locales se conservan.")) return;
    setSyncConfig(null);
    syncSha = null;
    setSyncEstado("local");
    cerrarConfigSync();
}

/* ─── Eventos UI ─── */
document.addEventListener("DOMContentLoaded", () => {
    render();
    setSyncEstado(getSyncConfig() ? "idle" : "local");
    if (getSyncConfig()) cargarDeNube();

    document.getElementById("prevWeek").addEventListener("click", () => {
        semanaActiva = sumarDias(semanaActiva, -7);
        render();
    });
    document.getElementById("nextWeek").addEventListener("click", () => {
        semanaActiva = sumarDias(semanaActiva, 7);
        render();
    });
    document.getElementById("todayBtn").addEventListener("click", () => {
        semanaActiva = lunesDeFecha(new Date());
        render();
    });

    // Modal del día
    document.getElementById("closeModal").addEventListener("click", cerrarEditor);
    document.getElementById("cancelEdit").addEventListener("click", cerrarEditor);
    document.getElementById("saveEdit").addEventListener("click", guardarEdicion);
    document.getElementById("addEventBtn").addEventListener("click", () => {
        document.getElementById("eventsEditList").appendChild(crearFilaEvento());
    });
    document.getElementById("modalBackdrop").addEventListener("click", e => {
        if (e.target.id === "modalBackdrop") cerrarEditor();
    });

    // Modal de recurrentes
    document.getElementById("recurringBtn").addEventListener("click", abrirGestorRecurrentes);
    document.getElementById("closeRecurring").addEventListener("click", cerrarGestorRecurrentes);
    document.getElementById("cancelRecurring").addEventListener("click", cerrarGestorRecurrentes);
    document.getElementById("saveRecurring").addEventListener("click", guardarRecurrentes);
    document.getElementById("recurringModal").addEventListener("click", e => {
        if (e.target.id === "recurringModal") cerrarGestorRecurrentes();
    });

    // Cerrar cualquier modal con ESC
    document.addEventListener("keydown", e => {
        if (e.key !== "Escape") return;
        if (!document.getElementById("modalBackdrop").hidden) cerrarEditor();
        else if (!document.getElementById("recurringModal").hidden) cerrarGestorRecurrentes();
        else if (!document.getElementById("syncModal").hidden) cerrarConfigSync();
    });

    document.getElementById("exportBtn").addEventListener("click", exportar);
    document.getElementById("importBtn").addEventListener("click", () =>
        document.getElementById("importFile").click()
    );
    document.getElementById("importFile").addEventListener("change", e => {
        if (e.target.files[0]) importar(e.target.files[0]);
        e.target.value = "";
    });
    document.getElementById("resetBtn").addEventListener("click", reset);

    // Modal de sync con GitHub
    document.getElementById("syncBtn").addEventListener("click", abrirConfigSync);
    document.getElementById("closeSync").addEventListener("click", cerrarConfigSync);
    document.getElementById("cancelSync").addEventListener("click", cerrarConfigSync);
    document.getElementById("saveSync").addEventListener("click", guardarConfigSync);
    document.getElementById("testSync").addEventListener("click", probarSync);
    document.getElementById("initFile").addEventListener("click", inicializarFichero);
    document.getElementById("disableSync").addEventListener("click", desconectarSync);
    document.getElementById("syncModal").addEventListener("click", e => {
        if (e.target.id === "syncModal") cerrarConfigSync();
    });
});
