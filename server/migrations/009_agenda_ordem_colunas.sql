-- Ordem de exibição das colunas no quadro de tarefas da Agenda, independente da ordem
-- fixa do rodízio de sábados (coluna "ordem", usada pela Escala — não pode ser tocada).
ALTER TABLE pessoas_escala ADD COLUMN ordem_agenda INTEGER;

UPDATE pessoas_escala SET ordem_agenda = CASE nome
    WHEN 'Willianzada' THEN 1
    WHEN 'Cacique' THEN 2
    WHEN 'Thigas' THEN 3
    WHEN 'Luquinhas' THEN 4
    WHEN 'Nogs' THEN 5
    ELSE ordem
END;
