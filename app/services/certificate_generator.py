from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, A4
from reportlab.pdfgen import canvas


BASE_DIR = Path(__file__).resolve().parents[2]
OUTPUT_DIR = BASE_DIR / "storage" / "certificates"


def generate_certificate(
    certificate_id: str,
    job_id: str,
    recipient_name: str,
    course_name: str,
    issuer_name: str,
    issue_date,
) -> str:
    """
    Generate one PDF using the application's single predefined template.

    Returns the absolute path of the generated PDF.
    """
    output_dir = OUTPUT_DIR / job_id
    output_dir.mkdir(parents=True, exist_ok=True)

    output_path = output_dir / f"{certificate_id}.pdf"

    width, height = landscape(A4)
    c = canvas.Canvas(str(output_path), pagesize=(width, height))

    # Predefined certificate template
    margin = 28
    c.setStrokeColor(colors.HexColor("#17365D"))
    c.setLineWidth(3)
    c.rect(margin, margin, width - 2 * margin, height - 2 * margin)

    c.setStrokeColor(colors.HexColor("#C9A227"))
    c.setLineWidth(1.2)
    c.rect(margin + 12, margin + 12, width - 2 * (margin + 12), height - 2 * (margin + 12))

    c.setFillColor(colors.HexColor("#17365D"))
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(width / 2, height - 105, "CERTIFICATE OF COMPLETION")

    c.setFillColor(colors.black)
    c.setFont("Helvetica", 13)
    c.drawCentredString(width / 2, height - 140, "This certificate is proudly presented to")

    c.setFillColor(colors.HexColor("#17365D"))
    c.setFont("Helvetica-Bold", 30)
    c.drawCentredString(width / 2, height - 195, recipient_name)

    c.setFillColor(colors.black)
    c.setFont("Helvetica", 13)
    c.drawCentredString(width / 2, height - 235, "for successfully completing")

    c.setFillColor(colors.HexColor("#C9A227"))
    c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(width / 2, height - 270, course_name)

    c.setFillColor(colors.black)
    c.setFont("Helvetica", 11)
    c.drawCentredString(
        width / 2,
        height - 315,
        f"Issued on {issue_date.strftime('%d %B %Y')}",
    )

    c.setStrokeColor(colors.HexColor("#777777"))
    c.line(100, 95, 270, 95)
    c.line(width - 270, 95, width - 100, 95)

    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(185, 78, issuer_name)
    c.drawCentredString(width - 185, 78, "Authorized Signatory")

    c.setFillColor(colors.HexColor("#777777"))
    c.setFont("Helvetica", 8)
    c.drawCentredString(width / 2, 48, f"Certificate ID: {certificate_id}")

    c.save()
    return str(output_path)
