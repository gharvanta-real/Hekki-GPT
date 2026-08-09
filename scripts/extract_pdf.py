import fitz

pdf_path = 'D:/Hekki-Assistant/data/workspace/attachments/1786170755093_Diet_Plan_Professional.pdf'
try:
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text()
    print(text)
except Exception as e:
    print(f"Error: {e}")
