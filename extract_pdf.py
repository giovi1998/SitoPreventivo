import pdfplumber

pdf_path = r'C:\Users\Giovanni\Downloads\Preventivo Sito Francesca.pdf'
output_path = r'C:\Users\Giovanni\Desktop\SitoPreventivo\pdf_content.txt'

with pdfplumber.open(pdf_path) as pdf:
    with open(output_path, 'w', encoding='utf-8') as f:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                f.write(text + '\n\n')

print(f"Text extracted successfully to {output_path}")
