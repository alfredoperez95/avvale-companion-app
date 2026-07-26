-- Sustituir frases fijas de plantillas por {{contenidoAdministrativo}}
-- (depende de PFE / Pedido en Detalles administrativos)

UPDATE `email_templates`
SET `content` = REPLACE(
  `content`,
  'Adjunto propuesta, PFE, aceptación del cliente y pedido',
  '{{contenidoAdministrativo}}'
)
WHERE `content` LIKE '%Adjunto propuesta, PFE, aceptación del cliente y pedido%';

UPDATE `email_templates`
SET `content` = REPLACE(
  `content`,
  'Adjunto propuesta, PFE, formulario de software y pedido',
  '{{contenidoAdministrativo}}'
)
WHERE `content` LIKE '%Adjunto propuesta, PFE, formulario de software y pedido%';
