/* ─────────────────────────────────────────────────────────────
   Datos iniciales del Semanario Familiar.

   Estructura:
     - familia: lista de personas con su id, nombre y color pastel
     - eventosRecurrentes: eventos fijos cada semana, agrupados por
                           día. Claves: lunes, martes, ..., domingo
                           (sin acentos para evitar problemas).
     - excepciones: para una fecha concreta, eventos recurrentes
                    que NO se aplican esa semana.
                    Formato { "YYYY-MM-DD": [{persona, hora, titulo}, ...] }
     - semana:   comidas/cenas y eventos puntuales por fecha.
                 Claves "YYYY-MM-DD".

   Edita este fichero a mano cuando quieras una plantilla base.
   Los cambios hechos desde la app se guardan en localStorage
   y tienen prioridad: usa el botón "Reset" para volver a este JSON.
   ───────────────────────────────────────────────────────────── */

const DATOS_INICIALES = {
    familia: [
        { id: "rodrigo",  nombre: "Rodrigo",  color: "#A8D8EA" }, // azul pastel
        { id: "pelayo",   nombre: "Pelayo",   color: "#B5EAD7" }, // verde menta
        { id: "cristina", nombre: "Cristina", color: "#FFB6C1" }, // rosa pastel
        { id: "hector",   nombre: "Héctor",   color: "#FFEAA7" }  // amarillo crema
        { id: "familia",  nombre: "Familia",  color: "#B8C6D9" }  // gris azulado
    ],

    eventosRecurrentes: {
        lunes: [
            { persona: "rodrigo",  hora: "19:00", titulo: "Hockey" },
            { persona: "cristina", hora: "18:00", titulo: "Coser" }
        ],
        martes: [
            { persona: "pelayo", hora: "18:30", titulo: "Fútbol" }
        ],
        miercoles: [
            { persona: "rodrigo", hora: "18:00", titulo: "Hockey" }
        ],
        jueves: [
            { persona: "rodrigo",  hora: "18:00", titulo: "Hockey" },
            { persona: "pelayo",   hora: "18:30", titulo: "Fútbol" },
            { persona: "cristina", hora: "17:30", titulo: "Tricotear" }
        ],
        viernes: [
            { persona: "pelayo", hora: "18:30", titulo: "Fútbol" }
        ],
        sabado:  [],
        domingo: []
    },

    excepciones: {},

    semana: {
        "2026-05-25": {
            comida: "Lentejas estofadas",
            cena: "Tortilla francesa y ensalada",
            eventos: [
                { persona: "cristina", hora: "10:00", titulo: "Médico de cabecera" }
            ]
        },
        "2026-05-26": {
            comida: "Pasta con tomate y atún",
            cena: "Pescado a la plancha con verduras",
            eventos: [
                { persona: "pelayo", hora: "17:30", titulo: "Clase de inglés" },
                { persona: "hector", hora: "19:00", titulo: "Gimnasio" }
            ]
        },
        "2026-05-27": {
            comida: "Pollo asado con patatas",
            cena: "Crema de calabacín",
            eventos: [
                { persona: "rodrigo", hora: "16:00", titulo: "Dentista" }
            ]
        },
        "2026-05-28": {
            comida: "Arroz con verduras",
            cena: "Hamburguesas caseras",
            eventos: [
                { persona: "pelayo",   hora: "20:00", titulo: "Música" }
            ]
        },
        "2026-05-29": {
            comida: "Macarrones con bechamel",
            cena: "Sopa y queso",
            eventos: [
                { persona: "hector", hora: "21:00", titulo: "Cena con amigos" }
            ]
        },
        "2026-05-30": {
            comida: "Paella",
            cena: "Pizza casera",
            eventos: [
                { persona: "rodrigo",  hora: "11:00", titulo: "Partido de hockey" },
                { persona: "pelayo",   hora: "17:00", titulo: "Cumpleaños amigo" }
            ]
        },
        "2026-05-31": {
            comida: "Asado familiar",
            cena: "Tabla de embutidos",
            eventos: []
        }
    }
};
