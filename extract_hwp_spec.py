#!/usr/bin/env python3
"""
Extract HWP 5.0 specification PDF and split into markdown files by major topics.
This script extracts text from the PDF and organizes it into separate markdown files
based on the major sections of the HWP 5.0 specification document.
"""

import os
import sys
import re

def extract_pdf_text():
    """Extract text from PDF using PyPDF2 or pdfplumber"""
    pdf_path = "docs/한글문서파일형식_5.0_revision1.3.pdf"

    # Try pdfplumber first (better text extraction)
    try:
        import pdfplumber
        print(f"✅ Using pdfplumber to extract PDF: {pdf_path}")

        text_by_page = []
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            print(f"📄 Total pages: {total_pages}")

            for i, page in enumerate(pdf.pages):
                page_text = page.extract_text()
                if page_text:
                    text_by_page.append({
                        'page': i + 1,
                        'text': page_text
                    })
                    print(f"  Page {i+1}/{total_pages} extracted ({len(page_text)} chars)")

        print(f"✅ Extracted {len(text_by_page)} pages")
        return text_by_page

    except ImportError:
        print("⚠️  pdfplumber not installed, trying PyPDF2...")

        try:
            import PyPDF2
            print(f"✅ Using PyPDF2 to extract PDF: {pdf_path}")

            text_by_page = []
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                total_pages = len(pdf_reader.pages)
                print(f"📄 Total pages: {total_pages}")

                for i, page in enumerate(pdf_reader.pages):
                    page_text = page.extract_text()
                    if page_text:
                        text_by_page.append({
                            'page': i + 1,
                            'text': page_text
                        })
                        print(f"  Page {i+1}/{total_pages} extracted ({len(page_text)} chars)")

            print(f"✅ Extracted {len(text_by_page)} pages")
            return text_by_page

        except ImportError:
            print("❌ Neither pdfplumber nor PyPDF2 is installed.")
            print("Please install one of them:")
            print("  pip install pdfplumber")
            print("  or")
            print("  pip install PyPDF2")
            sys.exit(1)

def find_major_sections(text_by_page):
    """Identify major sections in the document based on TOC patterns"""

    # Combine all text to find table of contents
    all_text = '\n'.join([page['text'] for page in text_by_page])

    # Common major section patterns in HWP 5.0 spec
    section_patterns = [
        r'^\d+\.\s+(.+?)$',  # "1. Introduction"
        r'^제\s*\d+\s*장\s+(.+?)$',  # "제 1 장 개요"
        r'^Chapter\s+\d+\s+(.+?)$',  # "Chapter 1 Overview"
    ]

    sections = []

    # Parse each page to find section headers
    for page in text_by_page:
        lines = page['text'].split('\n')

        for i, line in enumerate(lines):
            line = line.strip()

            # Look for section patterns
            for pattern in section_patterns:
                match = re.match(pattern, line, re.IGNORECASE)
                if match:
                    section_title = match.group(1).strip()

                    # Skip if too short or too long (likely not a section title)
                    if 3 <= len(section_title) <= 100:
                        sections.append({
                            'page': page['page'],
                            'title': section_title,
                            'line': line
                        })
                        print(f"  📑 Found section: '{line}' on page {page['page']}")

    return sections

def organize_by_topic(text_by_page):
    """Organize content into major topics"""

    # Define major topics based on typical HWP 5.0 spec structure
    topics = {
        '01-overview': {
            'title': '개요 및 구조 (Overview and Structure)',
            'keywords': ['개요', 'overview', '구조', 'structure', '파일 형식', 'file format'],
            'pages': []
        },
        '02-file-header': {
            'title': 'FileHeader',
            'keywords': ['fileheader', '파일 헤더', 'header'],
            'pages': []
        },
        '03-docinfo': {
            'title': 'DocInfo',
            'keywords': ['docinfo', '문서 정보', 'document info'],
            'pages': []
        },
        '04-bodytext': {
            'title': 'BodyText 및 Section',
            'keywords': ['bodytext', 'section', '본문', '섹션', 'paragraph'],
            'pages': []
        },
        '05-record-structure': {
            'title': 'Record 구조 (Record Structure)',
            'keywords': ['record', 'tag', '레코드', '태그'],
            'pages': []
        },
        '06-paragraph': {
            'title': 'Paragraph (문단)',
            'keywords': ['paragraph', 'para_header', 'para_text', '문단', 'para'],
            'pages': []
        },
        '07-compression': {
            'title': 'Compression (압축)',
            'keywords': ['compression', 'compress', 'zlib', 'deflate', '압축'],
            'pages': []
        },
        '08-text-encoding': {
            'title': 'Text Encoding (문자 인코딩)',
            'keywords': ['encoding', 'utf-16', 'unicode', '인코딩', '문자'],
            'pages': []
        },
        '09-tables-and-controls': {
            'title': 'Tables and Controls (표 및 컨트롤)',
            'keywords': ['table', 'control', '표', '컨트롤', 'object'],
            'pages': []
        },
        '10-appendix': {
            'title': 'Appendix (부록)',
            'keywords': ['appendix', 'reference', '부록', '참조'],
            'pages': []
        }
    }

    # Assign pages to topics
    for page in text_by_page:
        page_text_lower = page['text'].lower()

        # Find best matching topic
        best_match = None
        best_score = 0

        for topic_id, topic_info in topics.items():
            score = sum(1 for kw in topic_info['keywords'] if kw.lower() in page_text_lower)

            if score > best_score:
                best_score = score
                best_match = topic_id

        # Add to best matching topic (or overview if no match)
        if best_match and best_score > 0:
            topics[best_match]['pages'].append(page)
        else:
            topics['01-overview']['pages'].append(page)

    return topics

def write_markdown_files(topics):
    """Write organized content to markdown files"""

    output_dir = "docs/hwp-5.0"
    os.makedirs(output_dir, exist_ok=True)
    print(f"\n📁 Creating output directory: {output_dir}")

    for topic_id, topic_info in topics.items():
        if not topic_info['pages']:
            print(f"  ⏭️  Skipping {topic_id} (no pages)")
            continue

        filename = f"{output_dir}/{topic_id}.md"

        with open(filename, 'w', encoding='utf-8') as f:
            # Write header
            f.write(f"# {topic_info['title']}\n\n")
            f.write(f"이 문서는 한글문서파일형식 5.0 명세서에서 추출되었습니다.\n\n")
            f.write(f"**총 페이지 수:** {len(topic_info['pages'])}\n\n")
            f.write(f"---\n\n")

            # Write content from each page
            for page in topic_info['pages']:
                f.write(f"## Page {page['page']}\n\n")
                f.write(f"```\n")
                f.write(page['text'])
                f.write(f"\n```\n\n")
                f.write(f"---\n\n")

        print(f"  ✅ Created: {filename} ({len(topic_info['pages'])} pages)")

    # Create index file
    index_file = f"{output_dir}/README.md"
    with open(index_file, 'w', encoding='utf-8') as f:
        f.write("# HWP 5.0 명세서\n\n")
        f.write("한글문서파일형식 5.0 명세서를 주제별로 분할한 문서입니다.\n\n")
        f.write("## 목차\n\n")

        for topic_id, topic_info in topics.items():
            if topic_info['pages']:
                f.write(f"- [{topic_info['title']}](./{topic_id}.md) ({len(topic_info['pages'])} pages)\n")

    print(f"  ✅ Created: {index_file}")

def main():
    """Main function"""
    print("=" * 60)
    print("HWP 5.0 Specification PDF Extractor")
    print("=" * 60)
    print()

    # Step 1: Extract PDF text
    print("Step 1: Extracting PDF text...")
    text_by_page = extract_pdf_text()
    print()

    # Step 2: Organize by topic
    print("Step 2: Organizing content by topic...")
    topics = organize_by_topic(text_by_page)
    print()

    # Step 3: Write markdown files
    print("Step 3: Writing markdown files...")
    write_markdown_files(topics)
    print()

    print("=" * 60)
    print("✅ PDF extraction completed successfully!")
    print("=" * 60)
    print()
    print("Output directory: docs/hwp-5.0/")
    print()

if __name__ == '__main__':
    main()
