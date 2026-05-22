# SSH-Manager

Aplicación de escritorio para gestionar y monitorear instancias remotas vía SSH.

## MVP

El objetivo del MVP es construir una herramienta funcional que permita a un desarrollador o DevOps conectarse a una instancia en la nube y operarla desde una interfaz gráfica, eliminando la dependencia de terminales manuales y scripts dispersos.

### Funcionalidades del MVP

- **Autenticación local** — Inicio de sesión con usuario/contraseña almacenados en SQLite (hash Argon2id)
- **Conexión SSH** — Configuración de conexión mediante clave privada `.pem`, con test de conexión antes de guardar
- **Dashboard** — Resumen en tiempo real del estado del servidor: CPU, memoria, disco y load average
- **Monitoreo** — Métricas históricas con gráficas de los últimos 30 minutos, polling automático cada 30s
- **Scripts** — Creación, edición y ejecución remota de scripts `.sh` que se suben vía SFTP y se ejecutan vía SSH con output en tiempo real
- **Terminal integrada** — Panel inferior colapsable que muestra el output de scripts en ejecución
- **Modo claro/oscuro** — Soporte para ambos temas, con persistencia entre sesiones

### Alcance del MVP

- Un solo perfil de usuario por instalación
- Una sola instancia remota gestionada
- Autenticación SSH solo con clave `.pem` (sin contraseñas SSH)
- Monitoreo sin agente (polling vía comandos SSH)

### Stack

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite + Wouter + Zustand |
| Backend | Rust (Tauri V2) + russh |
| Base de datos | SQLite (sqlx) |
| UI | Radix UI + CSS Modules |

---

*Construido con Tauri V2 + React*