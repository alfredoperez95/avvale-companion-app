# Escaneo de seguridad de contenedores

Esta guía documenta cómo escanear imágenes, configuración Docker y filesystem del repositorio. Trivy o Syft no deben instalarse dentro de las imágenes productivas.

## Escaneo local con Trivy

Instalación en macOS:

```bash
brew install trivy
```

Construir imágenes locales:

```bash
docker build -t avvale-backend:security-check ./backend
docker build -t avvale-frontend:security-check ./frontend
```

Escanear imágenes:

```bash
trivy image avvale-backend:security-check
trivy image avvale-frontend:security-check
```

Escanear configuración Docker/IaC:

```bash
trivy config .
```

Escanear filesystem del repo:

```bash
trivy fs .
```

## Criterios recomendados

- Bloquear despliegue si aparece una vulnerabilidad `CRITICAL` con fix disponible.
- Revisar manualmente vulnerabilidades `HIGH`.
- No ignorar vulnerabilidades sin documentar componente, impacto, razón y fecha de revisión.
- Repetir el escaneo tras cambios en Dockerfile, lockfiles o imagen base.

Comando estricto sugerido para CI:

```bash
trivy image --exit-code 1 --severity CRITICAL avvale-backend:security-check
trivy image --exit-code 1 --severity CRITICAL avvale-frontend:security-check
trivy config --exit-code 1 --severity CRITICAL,HIGH .
```

## SBOM

Generar SBOM CycloneDX:

```bash
trivy image --format cyclonedx --output sbom-backend.json avvale-backend:security-check
trivy image --format cyclonedx --output sbom-frontend.json avvale-frontend:security-check
```

Alternativa con Syft:

```bash
syft avvale-backend:security-check -o cyclonedx-json=sbom-backend.json
syft avvale-frontend:security-check -o cyclonedx-json=sbom-frontend.json
```

No subir SBOM si contiene rutas, metadatos o nombres internos que el equipo no quiera publicar. No debe contener secretos.

## Falsos positivos y excepciones

Cada excepción temporal debe registrar:

- Imagen afectada.
- Paquete y versión.
- CVE o identificador.
- Motivo de aceptación.
- Compensating controls.
- Fecha de caducidad de la excepción.
- Responsable.

No aceptar excepciones indefinidas para `CRITICAL`.

## Docker Bench for Security

Ejecutar en el host requiere permisos administrativos y debe hacerse fuera de Cursor:

```bash
docker run --rm --net host --pid host --userns host --cap-add audit_control \
  -e DOCKER_CONTENT_TRUST=$DOCKER_CONTENT_TRUST \
  -v /etc:/etc:ro \
  -v /usr/bin/containerd:/usr/bin/containerd:ro \
  -v /usr/bin/runc:/usr/bin/runc:ro \
  -v /usr/lib/systemd:/usr/lib/systemd:ro \
  -v /var/lib:/var/lib:ro \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  --label docker_bench_security \
  docker/docker-bench-security
```

Revisar especialmente:

- Puertos publicados en `0.0.0.0`.
- Contenedores privilegiados.
- Montajes del Docker socket.
- Capabilities adicionales.
- Logs sin rotación.
- Redes no segmentadas.
- Versión de Docker y configuración del daemon.

No aplicar cambios al host sin ventana de mantenimiento y rollback.
