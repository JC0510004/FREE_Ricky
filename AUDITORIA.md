# Auditoría — sin hallazgos pendientes

Actualizado el 2026-10-06. Los tres hallazgos que quedaban abiertos están
resueltos, así que la lista de pendientes queda **vacía**. Se conservan aquí
los tres como registro de qué se tocó y cómo, más la tabla de los que se
descartaron por no sostenerse.

---

## Resueltos

### 1. Deriva entre `is_active` y `desactivado_por_admin` [RESUELTO]

**Antes:** las dos banderas solo se escribían juntas en un único punto
(`views_users.py:195-197`). El panel de administración alterna `is_active` a
mano sin tocar la marca, con dos estados rotos posibles:

- **ACTIVA + marca** → `views_email.py:85` rechaza la verificación de una
  cuenta que ya está activa: el usuario no puede verificar el correo y, con la
  verificación exigida para jugar, no puede usar la cuenta.
- **CERRADA sin marca** → `RegisterSerializer` reactiva la cuenta con solo
  volver a registrarse, deshaciendo el cierre del administrador.

**Cómo quedó** (dos defensas, una por dirección):

- `Usuario.save()` (`api/models.py:115`) normaliza la invariante *cuenta activa
  ⇒ sin marca* en todo guardado, y si el llamante usó `update_fields` añade el
  campo al conjunto: sin eso la normalización se quedaría en memoria y la
  deriva seguiría viva en la base de datos. Cubre ORM, panel, tests y cualquier
  endpoint futuro.
- `UsuarioAdmin.save_model` (`api/admin.py:20`) cubre la dirección contraria:
  si el panel cambia `is_active`, sincroniza la marca (`False ⇒ True` al
  cerrar, `True ⇒ False` al reactivar). Cerrar desde el panel queda marcado
  como cierre de administrador, que es lo que impide el re-registro.
- `desactivado_por_admin` pasó a `readonly_fields` (`api/admin.py:17`): solo lo
  escribe código, y aparece en `list_display` para que se vea sin abrir la ficha.

**Cobertura:** 3 tests nuevos en `api.tests.BanderasEstadoTests`
(`api/tests.py:2190`). Los dos de panel pasan por el form real de Django admin
(`POST` a la vista de cambio), no por llamadas directas al método.

### 2. `TRUSTED_PROXIES` cubría rangos privados enteros [RESUELTO]

**Antes:** el default era `10.0.0.0/8,172.16.0.0/12,192.168.0.0/16` en
`config/settings.py` **y** en `docker-compose.yml`, o sea: cualquier red
privada autorizada a elegir su propia identidad con `X-Real-IP` en cuanto
llegara a Django sin pasar por nginx. Esa identidad es la que usan a la vez el
throttle por IP (`api/throttles.py`) y el lockout de fuerza bruta
(`api/middleware.py`), así que con ella se rotaban cuotas y se reiniciaban
contadores de fallos. El propio comentario de `docker-compose.yml` ya decía que
había que confiar en la red del proxy "pero NO la red entera", y el default no
cumplía lo que decía.

**Matiz que hay que dejar claro:** hoy esa vía no existe — el compose no publica
el puerto del backend y nginx sobrescribe `X-Real-IP` en cada petición —, así
que el rango amplio no era un agujero explotable tal cual. El motivo de
estrecharlo es que siga sin serlo si algún día se publica el puerto, se añade
un contenedor a la red o se cambia el orquestador.

**Cómo quedó:**

- `app_network` tiene el subnet **fijado** en `docker-compose.yml`
  (`ipam.config.subnet: 172.16.42.0/24`); antes lo elegía Docker.
- `TRUSTED_PROXIES` pasa a `127.0.0.1,::1,172.16.42.0/24` en los tres sitios
  que lo declaran: `config/settings.py:51`, `docker-compose.yml` y el valor por
  defecto de interpolación. Queda sobreescribible por env para cuando delante
  haya un balanceador (DEPLOY_PRODUCCION.md §checklist).
- `.env.example` documenta la variable.

**Nota de despliegue:** como cambia la definición de la red, el primer
`docker compose up -d` posterior **recrea `app_network`** y los contenedores
que cuelgan de ella. Es lo esperado, pero hazlo con el stack parado.

**Comprobación:** `test_detras_de_proxy_confiable_se_usa_x_real_ip` sigue
passando con la IP del proxy ya dentro de la subnet nueva, y
`test_throttle_publico_ignora_xff_manipulado` sigue comprobando que una IP
fuera de confianza no puede rotar cubeta.

### 3. `django-ipware` instalado y sin usar [RESUELTO]

Borrado de `requirements.txt`. La única resolución de IP del proyecto es la
propia (`middleware.py:52-78`, `get_client_ip`), que además es la que usan
throttles y brute force: dos implementaciones habrían sido exactamente el
problema de coherencia del descartado de arriba.

---

## Descartados en esta revisión

| Hallazgo | Motivo del descarte |
|---|---|
| `AdminActionThrottle` no definido → ImportError en `/api/admin/*` | **Nunca existió.** `git log -S "AdminActionThrottle" --all` sin resultados. `views_admin.py` (87 líneas) no importa ningún throttle; las líneas 26 y 35 citadas son `summary=` y `serializer.data`. |
| Inconsistencia de IP: `get_ident` vs ipware vs `RealIPMiddleware` | **Desactualizado.** No hay `get_ident`, ni ipware, ni `RealIPMiddleware` en el código. `LoginThrottle` hereda de `PublicIPThrottle`, que sobrescribe `get_cache_key` y usa `get_client_ip` (`throttles.py:46-55`), con la preocupación resuelta y documentada en el docstring de `throttles.py:20-29`. El riesgo real que apuntaba era el resuelto 2. |
| `ConfirmacionReset` reutilizada para verificación de email | **Resuelto.** `VerificacionEmail` es un modelo propio desde la migración `0010` (`models.py`), usado solo por `views_email.py`. `ConfirmacionReset` solo aparece en `views_password_reset.py`. |
| Ranking sin posiciones estables entre páginas | **No aplica.** `RankingView` no pagina: devuelve el top-20 en una sola respuesta (`views_game.py:257-278`). `serializers.py:282-290` es `PasswordResetSerializer`. |
| "Dependencia no usada consistentemente" | Vago y duplicado del resuelto 3. |

---

## Verificación

- **152 tests del backend en verde**, 3 de ellos nuevos
  (`BanderasEstadoTests`). Ejecutados con `DATABASE_URL=sqlite://:memory:`
  porque en esta máquina no hay MySQL ni demonio de Docker: el CI los corre
  contra MySQL 8.4, que es donde valen de verdad. Ninguno de los tres tests
  nuevos depende de MySQL (`select_for_update` no interviene).
- `flake8 api/ --max-line-length=120 --extend-ignore=E501,W503` → limpio.
- `bandit -r api/ -ll` → sin hallazgos.
- `docker-compose.yml` parseado como YAML para confirmar el `ipam`.
