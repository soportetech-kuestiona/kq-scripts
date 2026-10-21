# kq-scripts

Scripts compartidos de las landings de Kuestiona. Se publican con GitHub Pages en
`https://soportetech-kuestiona.github.io/kq-scripts/`.

## kq-capture.js

Hace que los registros de un form nativo de ActiveCampaign lleguen también a DASH00
(vía el escenario de Make LD02). Sin este script, una landing con form de AC solo guarda el lead en AC.

### Qué tiene que hacer marketing

Si duplicas una landing que ya lo lleva: nada. La línea viaja con la página.

Si creas una landing nueva con form de AC, pega esto al final del `<body>`, fuera del bloque del form:

```html
<script src="https://soportetech-kuestiona.github.io/kq-scripts/kq-capture.js" data-funnel="may-vsl-mm" defer></script>
```

Lo único que se cambia es `data-funnel`, con el nombre del funnel tal como queremos verlo en DASH00
(`may-vsl-mm`, `mau-lanz-2609`...). Si no lo pones, se guarda el slug de la página.

No hace falta tocarlo si cambias textos, diseño o el propio form de AC. Solo hay que comprobar que la
línea sigue ahí si se rehace la página entera.

### Cómo comprobar que funciona

1. Abre la landing añadiendo `?kqdebug=1` a la URL y abre la consola del navegador (F12).
2. Debe aparecer `[kq-capture] enganchado al form de AC`.
3. Haz un registro con un email de prueba (`tech+prueba01@kuestiona.com`). En consola saldrá
   `datos capturados` y `enviado a Make`.
4. Revisa que la fila aparece en DASH00 › Leads con el funnel correcto.

### Para tech

- El envío se engancha a `window._load_script` del embed de AC, que solo se llama con
  `isSubmit=true` cuando el form pasa la validación. `_form_callback` no sirve: no se ejecuta si
  el form tiene redirección configurada en AC.
- Si la línea aparece dos veces en la página, solo actúa una.
- Webhook por defecto: LD02. Para otro escenario, `data-hook="https://hook.eu2.make.com/..."`.
- GitHub Pages cachea unos 10 minutos: un cambio aquí llega a todas las landings en ese margen,
  sin tocarlas. Cualquier cambio rompe todas a la vez, así que probar antes con `?kqdebug=1`.
- Las landings con form que hace POST directo a Make (tipo `may-lanz-2610`) no necesitan este script.
