# TransparentVideo Studio: WebGPU Real-Time Video Matting & Alpha Engine (BrowserOS)

[![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![WebGPU](https://img.shields.io/badge/WebGPU-WGSL_Matting_Shaders-FF4081?logo=webgpu&logoColor=white)](https://www.w3.org/TR/webgpu/)
[![Alpha Channel](https://img.shields.io/badge/Video-Transparent_WebM_VP9-10B981.svg)](#)
[![Anti-Smurf](https://img.shields.io/badge/Color_Space-100%25_RGBA_Integrity-6366F1.svg)](#)
[![Performance](https://img.shields.io/badge/Performance-60%2B_FPS_Real--Time-brightgreen.svg)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **Extensión de Chrome (Manifest V3) que convierte el navegador en una suite de eliminación de fondos de vídeo en tiempo real acelerada por hardware con WebGPU (shaders WGSL), visor en tablero de ajedrez (*checkerboard*), exportación de vídeo con canal Alfa en WebM VP9 y eliminación del "Efecto Pitufo".**

---

## ⚡ De la Aplicación de Escritorio a BrowserOS

En el proyecto original [**`0utKast/video_transparente`**](https://github.com/0utKast/video_transparente), la eliminación de fondo de vídeo requería un entorno de escritorio completo:
* Intérprete de Python, servidor Flask y dependencias de Pip (`rembg`, PyTorch / ONNX, OpenCV).
* Instalación de binarios externos de **FFmpeg** configurados en el `PATH` del sistema operativo.
* Tiempos de espera por lotes para procesar clips fotograma a fotograma.

**TransparentVideo Studio** traslada todo ese flujo a una **extensión nativa en el navegador**:
1. **Instalación en 1 clic:** Sin Python, sin dependencias pesadas y sin compilar nada en la terminal.
2. **100% Multiplataforma:** Funciona de forma idéntica en macOS (Apple Silicon M1/M2/M3/Intel), Windows, Linux y ChromeOS.
3. **Previsualización en tiempo real a 60+ FPS:** Gracias a los shaders de computación en **WebGPU**, el usuario puede ajustar los parámetros y ver el resultado con transparencia de inmediato.
4. **Privacidad Matemática (*Zero-Knowledge*):** Los vídeos nunca salen de la tarjeta gráfica del usuario.

---

## 🫐 El Misterio del "Efecto Pitufo" Resuelto

Uno de los problemas más comunes al procesar vídeo con IA en entornos de escritorio ocurre cuando la biblioteca de captura lee los píxeles en un orden de canales diferente al que espera el codificador.

```text
DESKTOP (Bug OpenCV):
  Cámara/Vídeo ──> cv2.VideoCapture() [Formato BGR] ──> IA/FFmpeg [Esperando RGBA]
  Canal Azul (B) se inyecta en Rojo (R)  =====> ¡Piel humana azul como un Pitufo! 🫐

BROWSEROS (Garantía RGBA):
  Cámara/Vídeo ──> OffscreenCanvas ──> WebGPU Texture (rgba8unorm)
  Canales estrictamente alineados en RGBA =====> ¡Tonos de piel cálidos y naturales! ✨
```

* **Simulador Educativo:** La extensión incluye un botón integrado **"Simular Efecto Pitufo"** que permite alternar la inversión de canales para comprobar en vivo cómo el orden de bytes afectaba al color original.

---

## 🌟 Características Principales

### 1. 🎨 Shaders WebGPU de Matting con Filtro Despill
* **Filtro Despill Integrado en WGSL:** Neutraliza activamente los reflejos verdes o azules (*color spill*) en los bordes del cabello, orejas y ropa, evitando halos antiestéticos.
* **Ajuste Fino de Borde (*Edge Tuning*):**
  * *Threshold (Umbral de corte):* Sensibilidad para separar sujeto y fondo.
  * *Feather (Suavizado):* Difuminado suave para contornos naturales sin cortes dentados.
  * *Choke / Expand:* Contracción o expansión de la máscara para ajustar milimétricamente el recorte.
  * *Invert Mask:* Opción para conservar el fondo y recortar el sujeto.

### 2. 🏁 Modos de Visualización y Fondos de Salida
* **Damero Alfa (*Checkerboard*):** Fondo clásico en tablero de ajedrez para verificar la transparencia real.
* **Croma Verde Puro (`#00FF00`):** Ideal para flujos de postproducción clásicos con etalonaje tradicional.
* **Estudio Virtual Cyberpunk:** Fondo procedural dinámico con suelo de cuadrícula neón y cielo degradado.
* **Oficina con Bokeh:** Fondo corporativo cálido y difuminado estilo cámara réflex.

### 3. 🎚️ Deslizador Interactivo A/B (*Split Screen*)
* Una barra divisoria vertical interactiva que permite arrastrar sobre el lienzo de vídeo para contrastar en vivo la imagen original (*Raw*) contra el resultado transparente recortado por la GPU.

### 4. 📹 Cuatro Fuentes Multimedia
1. **⚡ Presentador Sintético 60 FPS:** Animación procedural 3D con personaje, sombras y mechones de cabello. ¡Lista para probar al instante sin necesidad de buscar archivos de vídeo!
2. **📷 Cámara Web HD:** Captura en directo de la webcam con eliminación de fondo al vuelo.
3. **📁 Subir Vídeo MP4 / MOV / WebM:** Carga y procesa cualquier archivo local de tu disco.
4. **🖥️ Captura de Pantalla / Pestaña:** Extrae el fondo de cualquier pestaña o ventana en reproducción.

### 5. 🎬 Exportación con Transparencia Real
* **WebM con Canal Alfa (VP9 Alpha):** Grabación local directa a 60 FPS y 10 Mbps con soporte nativo de transparencia.
* **Instant Snapshot PNG:** Descarga un fotograma aislado en PNG transparente de 32 bits con un solo clic.
* **Flujo Apple ProRes 4444 (`.mov`):** Para flujos profesionales de cine o televisión en DaVinci Resolve o Final Cut Pro, el archivo WebM transparente se puede convertir instantáneamente a ProRes 4444 con el comando:
  ```bash
  ffmpeg -i video_transparente.webm -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le salida.mov
  ```

### 6. 🖥️ Doble Modo de Interfaz
* **Panel Lateral (Side Panel):** Consola compacta integrada en el lateral de Chrome mientras navegas.
* **Estudio Completo (Full Window):** Estación de trabajo en pantalla completa con visor panorámico y controles avanzados.

---

## 🛠️ Estructura del Proyecto

```text
transparent-video-studio/
├── dist/                              # Paquete compilado listo para cargar en Chrome
│   ├── manifest.json                  # Manifest V3 de producción
│   ├── background/service-worker.js   # Service worker compilado
│   ├── sidepanel/index.html           # Interfaz del panel lateral
│   ├── studio/index.html              # Estación de trabajo en pantalla completa
│   ├── icons/                         # Iconos en resoluciones 16, 48 y 128px
│   └── assets/                        # Bundles optimizados CSS y JS
├── src/
│   ├── background/
│   │   └── service-worker.ts          # Gestión de Side Panel y apertura de Studio Tab
│   ├── engines/
│   │   ├── matting-engine.ts          # Orquestador del motor de matting y demo procedural
│   │   ├── webgpu-matting-pipeline.ts # Shaders WGSL, texturas rgba8unorm y render pass
│   │   └── anti-smurf-pipeline.ts     # Verificación de integridad cromática y fallback 2D
│   ├── shaders/
│   │   └── matting.wgsl.ts            # Shaders WGSL (Vertex, Fragment, Despill, Checkerboard)
│   ├── components/
│   │   ├── video-source-manager.ts    # Gestor de webcam, archivos, pantalla y demo sintética
│   │   ├── checkerboard-viewport.ts   # Lienzo interactivo con deslizador A/B
│   │   ├── export-manager.ts          # Grabador WebM Alpha y capturas PNG
│   │   └── telemetry-hud.ts           # Medidor de FPS, latencia y cobertura
│   ├── sidepanel/                     # Controlador y estilos del panel lateral
│   └── studio/                        # Workstation completa en pestaña independiente
├── scripts/
│   └── generate-icons.js              # Generador autónomo de iconos PNG
├── public/                            # Recursos estáticos
├── manifest.json                      # Configuración fuente Manifest V3
├── vite.config.ts                     # Configuración de empaquetado Vite
├── tsconfig.json                      # Configuración TypeScript
├── CHROMEWEBSTORE.md                  # Ficha técnica para la Chrome Web Store
└── package.json                       # Scripts y dependencias
```

---

## 🚀 Cómo Instalar y Probar en Google Chrome

### Opción A: Cargar directamente la versión lista (Recomendada)
1. Abre Google Chrome y escribe en la barra de direcciones:
   ```text
   chrome://extensions/
   ```
2. En la esquina superior derecha, activa el interruptor **"Modo de desarrollador"** (*Developer mode*).
3. Haz clic en el botón **"Cargar descomprimida"** (*Load unpacked*).
4. Selecciona la carpeta **`dist`** dentro de este proyecto:
   ```text
   transparent-video-studio/dist
   ```
5. ¡Listo! La extensión **"TransparentVideo Studio"** aparecerá instalada.
6. Pulsa sobre el icono de la extensión en la barra de Chrome para abrir el **Side Panel** o pulsa el icono superior para abrir el **Estudio en pantalla completa**.

### Opción B: Compilar desde el código fuente
```bash
# 1. Instalar dependencias
npm install

# 2. Compilar TypeScript y empaquetar con Vite
npm run build

# 3. (Opcional) Regenerar iconos
npm run generate-icons
```

---

## 🔒 Privacidad y Rendimiento

* **Zero-Cloud Processing:** Todas las texturas, fotogramas de cámara web y vídeos cargados se procesan 100% de forma local en la memoria VRAM de la GPU del usuario.
* **Sin Transmisión de Vídeo:** Ningún flujo audiovisual es transmitido ni almacenado en servidores externos.

---

## 📄 Licencia

Este proyecto está bajo la Licencia [MIT](LICENSE).
