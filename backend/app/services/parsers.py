import csv
from io import StringIO

from docx import Document
from pypdf import PdfReader


def extract_text_from_pdf(path: str) -> str:
    reader = PdfReader(path)
    parts = []
    for page in reader.pages:
        parts.append(page.extract_text() or '')
    return '\n'.join(parts)


def extract_text_from_docx(path: str) -> str:
    doc = Document(path)
    return '\n'.join([p.text for p in doc.paragraphs])


def extract_text_from_csv_bytes(file_bytes: bytes) -> str:
    decoded = file_bytes.decode('utf-8', errors='ignore')
    reader = csv.reader(StringIO(decoded))
    rows = []
    for row in reader:
        cleaned = [cell.strip() for cell in row if cell.strip()]
        if cleaned:
            rows.append(' | '.join(cleaned))
    return '\n'.join(rows)
