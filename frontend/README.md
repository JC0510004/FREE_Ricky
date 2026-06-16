# Salt Born - Frontend

Frontend oficial de Salt Born, un desafiante plataformas pirata.

## Requisitos

- Node.js 20+
- npm

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

El servidor de desarrollo se ejecuta en `http://localhost:5173`.

## Producción

```bash
npm run build
```

Los archivos estáticos se generan en la carpeta `dist/`.

## Docker

```bash
docker build -t saltborn-frontend .
docker run -p 5173:5173 saltborn-frontend
```

## API

La aplicación se conecta a `http://127.0.0.1:8000/api` por defecto.
