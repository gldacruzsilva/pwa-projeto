USE banco_campo;

ALTER TABLE `Comanda`
  ADD COLUMN `numero_exibicao` INT NULL AFTER `codc`,
  ADD COLUMN `data_operacional` DATE NULL AFTER `numero_exibicao`;

UPDATE `Comanda` c
JOIN (
  SELECT
    codc,
    DATE(DATE_SUB(data_venda, INTERVAL 6 HOUR)) AS data_operacional,
    ROW_NUMBER() OVER (
      PARTITION BY DATE(DATE_SUB(data_venda, INTERVAL 6 HOUR))
      ORDER BY data_venda ASC, codc ASC
    ) AS numero_exibicao
  FROM `Comanda`
) numeradas ON numeradas.codc = c.codc
SET c.data_operacional = numeradas.data_operacional,
    c.numero_exibicao = numeradas.numero_exibicao;

ALTER TABLE `Comanda`
  MODIFY COLUMN `numero_exibicao` INT NOT NULL,
  MODIFY COLUMN `data_operacional` DATE NOT NULL,
  ADD UNIQUE INDEX `uk_Comanda_data_numero` (`data_operacional` ASC, `numero_exibicao` ASC);

CREATE TABLE IF NOT EXISTS `ContadorComanda` (
  `data_operacional` DATE NOT NULL,
  `ultimo_numero` INT NOT NULL,
  PRIMARY KEY (`data_operacional`)
) ENGINE = InnoDB;

INSERT INTO `ContadorComanda` (`data_operacional`, `ultimo_numero`)
SELECT `data_operacional`, MAX(`numero_exibicao`)
FROM `Comanda`
GROUP BY `data_operacional`;
