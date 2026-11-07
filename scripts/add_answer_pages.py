#!/usr/bin/env python3
"""Append query-shaped answer pages to the McpStamp showcase.

Every entry here maps one exact phrasing to a tool that really exists, and the copy
states only what the tool's own tool list exposes. us_volume stays 0 unless the number
came from Search Console, so nothing in the build claims demand we have not measured.
"""
import json, sys, pathlib

P = pathlib.Path.home() / "mcp-servers-work/showcase/site/src/data/pages.json"

NEW = [
    ("read-pdfs", "pdf", "Can Claude read a PDF? Yes, and pull the text out",
     "can claude read a pdf", "Yes. Claude reads PDFs and, with the pdf server, counts pages, extracts page ranges and reports what is actually inside the file before you quote a number from it."),
    ("merge-pdfs", "pdf", "Can Claude merge PDFs? Yes, combine them in one call",
     "can claude merge pdfs", "Yes. The pdf server merges files in the order you name them, keeps page numbering sane and returns a single download. Claude does the ordering from one sentence."),
    ("split-a-pdf", "pdf", "Can Claude split a PDF into separate files?",
     "can claude split a pdf", "Yes. Split by page range or pull single pages out of a long scan with the pdf server, then hand each part to the next step of the job."),
    ("rotate-pdf-pages", "pdf", "Can Claude rotate pages in a PDF?",
     "can claude rotate pdf pages", "Yes. Rotate a whole file or just the sideways pages from a phone scan, without opening a desktop editor."),
    ("watermark-a-pdf", "pdf", "Can Claude watermark a PDF before you send it?",
     "can claude watermark a pdf", "Yes. Stamp a draft or confidentiality mark across every page with the pdf server, so a client copy never leaves without a label."),
    ("read-a-scanned-pdf", "pdf", "Can Claude read a scanned PDF?",
     "can claude read a scanned pdf", "Partly. A scan is an image until something reads the pixels. The pdf server tells you whether the file has real text or is image only, which decides if OCR is needed."),
    ("convert-word-to-pdf", "docx", "Can Claude turn a Word document into a PDF?",
     "can claude convert word to pdf", "Yes. Write or edit the .docx with the docx server, then produce the PDF copy a client can no longer edit."),
    ("read-word-documents", "docx", "Can Claude read a Word document?",
     "can claude read word documents", "Yes. Claude reads .docx text and the docx server edits the file in place, keeping styles and headings instead of pasting plain text into a new file."),
    ("read-a-csv-file", "spreadsheet", "Can Claude read a CSV file?",
     "can claude read a csv file", "Yes. The spreadsheet server loads the file, reports columns and row count, then answers questions over it without you cleaning it first."),
    ("convert-csv-to-excel", "spreadsheet", "Can Claude convert a CSV into an Excel file?",
     "can claude convert csv to excel", "Yes. Load the CSV, query it to check the shape, then write a real .xlsx with the sheet named and the header row intact."),
    ("query-a-spreadsheet", "spreadsheet", "Can Claude answer questions about a spreadsheet?",
     "can claude query an excel file", "Yes. The spreadsheet server runs the query on the file, not on a guess, and returns the matching rows plus the totals you asked for."),
    ("unzip-a-password-protected-file", "zip", "Can Claude open a password protected zip?",
     "can claude unzip a password protected file", "Yes, if you supply the password. The zip server extracts to a workspace and lists what came out, so a corrupted archive fails loudly instead of silently."),
    ("create-a-zip-archive", "zip", "Can Claude put files into a zip archive?",
     "can claude create a zip file", "Yes. Bundle a set of documents into one archive with the zip server when a client wants a single attachment rather than eleven."),
    ("list-what-is-inside-a-zip", "zip", "Can Claude tell you what is inside a zip file?",
     "can claude list files in a zip", "Yes. The zip server lists names, sizes and folders before extraction, which is how you spot the archive that contains something you did not expect."),
    ("read-a-scanned-receipt", "receipts", "Can Claude read a photographed receipt?",
     "can claude read a receipt", "Yes. The receipts server stores the image with its amount, date and vendor so the expense record survives the photo being deleted from a phone."),
    ("track-receipts-for-expenses", "receipts", "Can Claude keep receipts organised for expenses?",
     "can claude organise receipts", "Yes. One record per receipt with vendor, date, amount and tax, queryable at the end of the month instead of a folder of images."),
    ("resize-an-image", "image", "Can Claude resize an image?",
     "can claude resize an image", "Yes. The image server resizes to exact pixel dimensions, which is what a marketplace or form actually demands."),
    ("strip-photo-metadata", "image", "Can Claude remove metadata from a photo?",
     "can claude remove exif data", "Yes. Strip GPS and camera details before a photo goes into a public listing or a client document."),
    ("convert-an-image-format", "image", "Can Claude convert an image to another format?",
     "can claude convert image format", "Yes. Convert between formats with the image server when an upload rejects the original extension."),
    ("check-a-supplier-statement", "supplier-statement-check", "Can Claude check a supplier statement against your ledger?",
     "can claude check a supplier statement", "Yes. The supplier statement check compares their balance against yours and lists the invoices each side is missing, which is the argument you need before paying."),
    ("make-a-three-way-match", "three-way-match", "Can Claude do a three way match on a purchase?",
     "can claude do a three way match", "Yes. Purchase order, goods receipt and invoice compared line by line, with quantity and price differences called out per item."),
    ("track-a-budget", "budget", "Can Claude track a budget month to month?",
     "can claude track a budget", "Yes. Categories, actuals and remaining amounts live in the budget server, so the answer is a number rather than a recollection."),
    ("write-a-quote", "quotes", "Can Claude write a quote for a client?",
     "can claude write a quote", "Yes. Line items, quantities, tax and validity date, produced as a document the client can accept instead of a paragraph in an email."),
]

def main():
    pages = json.loads(P.read_text())
    have = {p["path"] for p in pages}
    added = 0
    for slug, server, title, kw, meta in NEW:
        path = f"/can-claude/{slug}/"
        if path in have:
            continue
        pages.append({
            "path": path,
            "title": title + " | {brand}",
            "h1": title.split("?")[0] + "?",
            "meta_description": meta,
            "primary_keyword": kw,
            "intent": "informational",
            "priority": 0.7,
            "servers": [server],
            "us_volume": 0,
            "page_type": "answer",
        })
        added += 1
    P.write_text(json.dumps(pages, indent=2) + "\n")
    print(f"added {added}, total {len(pages)}")

if __name__ == "__main__":
    main()
