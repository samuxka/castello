# Auditoria de Segurança — Projeto Castello

Este diretório contém o relatório de auditoria de segurança em PDF e o script gerador para recriá-lo após novas rodadas de correção.

## Arquivos
- `relatorio-auditoria-seguranca.pdf` — Relatório completo da auditoria (capa, resumo executivo com gráficos, pontos fortes/fracos, achados por categoria, recomendações P1–P4 e issues prontas para o GitHub).
- `generate_report.py` — Script Python (ReportLab + Matplotlib) que gera o PDF.
- `requirements.txt` — Dependências isoladas para geração do relatório.

## Como regerar o PDF (ambiente isolado)

```powershell
python -m venv .venv
.\.venv\Scripts\pip install -r docs/security-audit/requirements.txt
.\.venv\Scripts\python docs/security-audit/generate_report.py
```
