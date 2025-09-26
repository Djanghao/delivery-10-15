# 审批管理系统文档关键内容抽取

需要提取的信息有:

项目代码、项目名称、项目类型、建设性质、拟开工时间、拟建成时间、建设规模与建设内容（生产能力）、项目联系人姓名、项目联系人手机、项目投资情况、项目（法人）单位、成立日期、法定代表人、法定代表人手机号码

项目代码和项目名称是从网站提取的, 其他是从pdf中提取的

提取代码:
```python
import csv
import glob
import os
import re
from typing import Dict, List

import pdfplumber

# Fields requested by the user, in output order
FIELD_NAMES: List[str] = [
    "source_pdf",
    "项目名称",
    "项目类型",
    "建设性质",
    "拟开工时间",
    "拟建成时间",
    "建设规模与建设内容（生产能力）",
    "项目联系人姓名",
    "项目联系人手机",
    "总投资",
    "固定投资",
    "土建工程",
    "设备购置费",
    "安装工程",
    "工程建设其他费用",
    "预备费",
    "建设期利息",
    "铺底流动资金",
    "财政性资金",
    "自有资金（非财政性资金）",
    "银行贷款",
    "其它",
    "项目（法人）单位",
    "成立日期",
    "法定代表人",
    "法定代表人手机号码",
]

# Label normalisation maps
TEXT_LABEL_MAP = {
    "项目名称": "项目名称",
    "项目类型": "项目类型",
    "建设性质": "建设性质",
    "拟开工时间": "拟开工时间",
    "拟建成时间": "拟建成时间",
    "建设规模与建设内容（生产能力）": "建设规模与建设内容（生产能力）",
    "建设规模与建设内容": "建设规模与建设内容（生产能力）",
    "项目联系人姓名": "项目联系人姓名",
    "项目联系人手机": "项目联系人手机",
    "项目（法人）单位": "项目（法人）单位",
    "成立日期": "成立日期",
    "法定代表人": "法定代表人",
    "法定代表人手机号码": "法定代表人手机号码",
    "法定代表人手机号": "法定代表人手机号码",
}

INVEST_COLUMNS = {
    "合计": "总投资",
    "土建工程": "土建工程",
    "设备购置费": "设备购置费",
    "安装工程": "安装工程",
    "工程建设其他费用": "工程建设其他费用",
    "预备费": "预备费",
    "建设期利息": "建设期利息",
    "铺底流动资金": "铺底流动资金",
}

FUND_COLUMNS = {
    "合计": "资金来源合计",
    "财政性资金": "财政性资金",
    "自有资金（非财政性资金）": "自有资金（非财政性资金）",
    "银行贷款": "银行贷款",
    "其它": "其它",
}

SECTION_END_MARKERS = (
    "项目单位基本情况",
    "项目变更情况",
    "项目单位声明",
)

FIXED_INVEST_PATTERN = re.compile(r"固定投资([0-9]+(?:\.[0-9]+)?)万元")
NUMERIC_PATTERN = re.compile(r"^[-+]?\d+(?:\.\d+)?$")


def clean(cell: str) -> str:
    if not cell:
        return ""
    return cell.replace("\n", "").strip()


def is_numeric(cell: str) -> bool:
    return bool(cell) and bool(NUMERIC_PATTERN.match(cell))


def extract_from_pdf(pdf_path: str) -> Dict[str, str]:
    data: Dict[str, str] = {field: "" for field in FIELD_NAMES if field != "source_pdf"}
    data["固定投资"] = ""  # ensure present even if not overwritten

    with pdfplumber.open(pdf_path) as pdf:
        tables: List[List[str]] = []
        for page in pdf.pages:
            table = page.extract_table(
                table_settings={
                    "vertical_strategy": "lines",
                    "horizontal_strategy": "lines",
                }
            )
            if table:
                tables.extend(table)

    current_section = None
    column_labels: Dict[int, str] = {}

    for row in tables:
        cells = [clean(c) for c in row]
        if not any(cells):
            continue

        # Detect section switches
        if any("项目投资情况" in cell for cell in cells):
            current_section = "invest"
            column_labels = {}
            continue
        if "资金来源（万元）" in cells:
            current_section = "fund"
            column_labels = {}
            continue
        if any(marker in cell for cell in cells if cell for marker in SECTION_END_MARKERS):
            current_section = None
            column_labels = {}

        if any("项目（法人）单位" in cell for cell in cells if cell):
            current_section = None
            column_labels = {}

        # Record column headers for numeric sections
        if current_section == "invest":
            for idx, cell in enumerate(cells):
                if cell in INVEST_COLUMNS:
                    column_labels[idx] = INVEST_COLUMNS[cell]
        elif current_section == "fund":
            for idx, cell in enumerate(cells):
                if cell in FUND_COLUMNS:
                    column_labels[idx] = FUND_COLUMNS[cell]

        # Fixed investment is embedded in the header row
        for cell in cells:
            match = FIXED_INVEST_PATTERN.search(cell)
            if match:
                data["固定投资"] = match.group(1)

        # Capture textual label/value pairs when not in numeric-only context
        if current_section not in ("invest", "fund"):
            for idx, label in enumerate(cells):
                if not label:
                    continue
                norm_label = TEXT_LABEL_MAP.get(label)
                if not norm_label:
                    continue
                # Find the next non-empty cell to the right that is not another label
                value = ""
                for j in range(idx + 1, len(cells)):
                    candidate = cells[j]
                    if not candidate:
                        continue
                    if candidate in TEXT_LABEL_MAP or candidate in INVEST_COLUMNS or candidate in FUND_COLUMNS:
                        continue
                    value = candidate
                    break
                if value:
                    data[norm_label] = value

        # Handle numeric rows for investment/funding sections
        if current_section in ("invest", "fund") and any(is_numeric(cell) for cell in cells):
            for idx, cell in enumerate(cells):
                if not is_numeric(cell):
                    continue
                field = column_labels.get(idx)
                if not field or field == "资金来源合计":
                    continue
                data[field] = cell

        # Once we leave numeric sections we keep column_labels clean
        if current_section in ("invest", "fund") and not any(column_labels.values()):
            column_labels = {}

    # Some documents embed total investment only in the numeric row; ensure it's set
    if not data.get("总投资"):
        # Fallback: use fixed investment if totals match (common in these forms)
        data["总投资"] = data.get("固定投资", "")

    return data


def main() -> None:
    pdf_paths = sorted(glob.glob(os.path.join("input", "*.pdf")))
    rows: List[Dict[str, str]] = []

    for pdf_path in pdf_paths:
        extracted = extract_from_pdf(pdf_path)
        extracted_row = {field: "" for field in FIELD_NAMES}
        extracted_row["source_pdf"] = os.path.basename(pdf_path)
        for field in FIELD_NAMES:
            if field == "source_pdf":
                continue
            extracted_row[field] = extracted.get(field, "")
        rows.append(extracted_row)

    output_path = "extracted_results.csv"
    with open(output_path, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=FIELD_NAMES)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Saved extraction results to {output_path}")


if __name__ == "__main__":
    main()
```