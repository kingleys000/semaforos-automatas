# Estudio del Cruce · Simulación 2D y Autómatas de Semáforos

Representación y simulación 2D interactiva del flujo vehicular y control de semáforos en la intersección vial de **La Gran Colombia**, **Diagonal Santander**, **Calle 9**, **Calle 9a** y **Calle 10**.

## 📌 Características

- **Simulación interactiva offline**: Archivo `calles_2d.html` autocontenido, sin dependencias externas.
- **5 semáforos configurables (S1 a S5)**: Control de fases (verde, amarillo, rojo), tiempos ajustables y secuencia coordinada.
- **Flujos vehiculares modelados**:
  - Calle 9a recibe tráfico desde Calle 9 y La Gran Colombia.
  - Calle 10 con sentido único saliendo del cruce, alimentada desde La Gran Colombia y ambos sentidos de la Diagonal Santander.
  - Generación dinámica de vehículos y control de flujo porcentual.
- **Herramientas de construcción y verificación**:
  - Scripts en Python para reconstruir la geometría y empaquetar la simulación (`tools/build_simulation.py`).
  - Verificación de consistencia y rutas (`tools/check_simulation.cjs`).

## 🚀 Cómo ejecutar

Simplemente abre el archivo `calles_2d.html` en cualquier navegador web moderno:

```bash
# En Windows (PowerShell):
Start-Process calles_2d.html
```

## 🛠️ Estructura del Proyecto

```text
semaforos_automatas/
├── calles_2d.html               # Simulación compilada autocontenida
├── plano_editable.html          # Vista editable del plano
├── map_geometry.json            # Geometría vectorial de vías e islas
├── referncia_googlemaps.png     # Captura de referencia original
├── vista_calles_2d.png          # Captura previa de la simulación
├── vista_calles_2d.gif          # Demostración animada
├── tools/
│   ├── build_simulation.py      # Empaqueta geometría, plantilla y lógica JS
│   ├── simulation.js            # Lógica central de rutas, semáforos y autos
│   ├── simulation.template.html # Plantilla base HTML
│   ├── render_preview.py        # Generación de vistas previas
│   ├── trace_reference.py       # Trazado de geometrías de referencia
│   └── check_simulation.cjs     # Suite de pruebas y validaciones
└── verificacion/                # Validaciones de rutas, recorridos y cuadros
```

## ⚙️ Reconstrucción de la Simulación

Si modificas la plantilla o la lógica en `tools/`, puedes reconstruir el archivo final ejecutando:

```bash
python tools/build_simulation.py
```
