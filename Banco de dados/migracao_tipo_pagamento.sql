USE banco_campo;

CREATE TABLE IF NOT EXISTS `TipoPagamento` (
  `codtp` INT NOT NULL AUTO_INCREMENT,
  `descricao` VARCHAR(45) NOT NULL,
  `status` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`codtp`),
  UNIQUE INDEX `uk_TipoPagamento_descricao` (`descricao` ASC)
) ENGINE = InnoDB;

INSERT IGNORE INTO `TipoPagamento` (`descricao`, `status`) VALUES
('Dinheiro', 1),
('Débito', 1),
('Crédito', 1),
('PIX', 1);

INSERT IGNORE INTO `TipoPagamento` (`descricao`, `status`)
SELECT DISTINCT TRIM(`tipo_pagamento`), 1
FROM `Pagamento`
WHERE `tipo_pagamento` IS NOT NULL AND TRIM(`tipo_pagamento`) <> '';

ALTER TABLE `Pagamento`
  ADD COLUMN `codtp` INT NULL AFTER `codc`,
  ADD COLUMN `status` VARCHAR(45) NOT NULL DEFAULT 'Pago' AFTER `codtp`;

UPDATE `Pagamento` p
JOIN `TipoPagamento` tp
  ON LOWER(TRIM(tp.`descricao`)) = LOWER(TRIM(p.`tipo_pagamento`))
SET p.`codtp` = tp.`codtp`;

ALTER TABLE `Pagamento`
  MODIFY COLUMN `codtp` INT NOT NULL,
  DROP COLUMN `tipo_pagamento`,
  ADD INDEX `fk_Pagamento_TipoPagamento_idx` (`codtp` ASC),
  ADD CONSTRAINT `fk_Pagamento_TipoPagamento`
    FOREIGN KEY (`codtp`)
    REFERENCES `TipoPagamento` (`codtp`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;
