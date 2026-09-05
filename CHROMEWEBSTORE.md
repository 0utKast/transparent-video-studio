# Chrome Web Store Listing: TransparentVideo Studio

## Listing Metadata

* **Extension Name:** TransparentVideo Studio (BrowserOS)
* **Summary (132 chars max):** Elimina el fondo de vídeos en tiempo real con WebGPU, shaders Despill, canal Alfa en WebM VP9 y tolerancia cromática sin efecto pitufo.
* **Category:** Developer Tools / Photos & Video
* **Primary Language:** Spanish (Español)
* **Version:** 1.0.0
* **Last Updated:** 2026-09-06

---

## Detailed Description

**TransparentVideo Studio** convierte tu navegador en una mesa de etalonaje y eliminación de fondos de vídeo en tiempo real acelerada por hardware mediante **WebGPU (shaders WGSL)** y **WebAssembly**.

Permite extraer siluetas y fondos transparentes directamente desde la tarjeta gráfica del usuario, sin subir ningún archivo a servidores externos y preservando al 100% la fidelidad de color en espacio **RGBA** (eliminando el clásico "Efecto Pitufo" que afectaba a herramientas basadas en OpenCV).

### 🌟 Características Principales

1. 🏁 **Transparencia Real y Fondo Damero (*Checkerboard*):**
   - Visualización interactiva en tiempo real sobre tablero de ajedrez o fondos virtuales.
   - Deslizador comparativo A/B en vivo para comparar la señal original frente al recorte con canal alfa.

2. 🎨 **Shaders WebGPU con Filtro Despill:**
   - Supresión activa de contaminación de color (despill filter) que neutraliza halos verdes o azules en cabello y ropa.
   - Controles precisos de umbral de corte (*Threshold*), difuminado suave (*Feather*) y dilatación de borde (*Choke*).

3. 🎬 **Exportación de Alta Calidad con Canal Alfa:**
   - Grabación local directa a **WebM con transparencia (VP9/VP8 Alpha)** a 60 FPS y 10 Mbps.
   - Captura instantánea de fotogramas en PNG transparente de 32 bits.
   - Pipeline de conversión a **Apple ProRes 4444 (`.mov`)** para edición profesional en DaVinci Resolve, Final Cut Pro y Adobe Premiere.

4. 📹 **Múltiples Entradas de Vídeo:**
   - Demo procedural animada a 60 FPS (lista para probar al instante sin cargar archivos).
   - Cámara web HD en directo.
   - Subida de archivos de vídeo locales (MP4, MOV, WebM, MKV).
   - Captura de pantalla, ventanas o pestañas de Chrome.

---

## Permissions Justification

| Permission | Justification |
| :--- | :--- |
| `sidePanel` | Necesario para mostrar la consola rápida de eliminación de fondo mientras navegas. |
| `storage` | Necesario para guardar las preferencias del usuario (tolerancia de color, umbrales y fondos). |
| `tabs` | Permite abrir la estación de trabajo completa (*Studio Tab*) en una pestaña dedicada. |
| `scripting` | Necesario para la captura de pantalla o pestañas en reproducción tras interacción del usuario. |
| `activeTab` | Garantiza acceso temporal seguro al capturar fuentes multimedia en la pestaña activa. |

---

## Privacy & Data Use Disclosure

* **Zero-Cloud Processing:** Todo el procesamiento y extracción de alfa se realiza 100% en local en la memoria GPU/VRAM del usuario.
* **Sin Recopilación de Datos:** Ningún vídeo, fotograma ni transmisión de cámara web es registrado ni enviado a servidores externos.
