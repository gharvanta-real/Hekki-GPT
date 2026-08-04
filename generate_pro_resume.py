from fpdf import FPDF

class FullStackResume(FPDF):
    def header(self):
        # Header Background
        self.set_fill_color(41, 128, 185)
        self.rect(0, 0, 210, 40, 'F')
        
        # Name
        self.set_text_color(255, 255, 255)
        self.set_font('Arial', 'B', 28)
        self.cell(0, 20, 'ALEX R. DEV', 0, 1, 'C')
        
        # Subtitle
        self.set_font('Arial', '', 12)
        self.cell(0, 5, 'Senior Full-Stack Developer | Cloud Architect', 0, 1, 'C')
        self.ln(15)
        self.set_text_color(0, 0, 0)

    def section_title(self, title):
        self.set_font('Arial', 'B', 14)
        self.set_text_color(41, 128, 185)
        self.cell(0, 10, title, 0, 1, 'L')
        self.set_draw_color(41, 128, 185)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(5)
        self.set_text_color(0, 0, 0)

    def body_text(self, text):
        self.set_font('Arial', '', 11)
        self.multi_cell(0, 7, text)
        self.ln(2)

# Generate PDF
pdf = FullStackResume()
pdf.add_page()

# Contact Info
pdf.set_font('Arial', '', 10)
pdf.cell(0, 5, 'Phone: +1 (555) 012-3456 | Email: alex.dev@email.com | GitHub: github.com/alexdev', 0, 1, 'C')
pdf.ln(10)

# Summary
pdf.section_title('Professional Summary')
pdf.body_text('Results-driven Full-Stack Developer with 7+ years of experience in designing scalable web applications. Expert in React, Node.js, and AWS cloud infrastructure. Passionate about clean code, performance optimization, and mentoring engineering teams.')

# Experience
pdf.section_title('Experience')
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 7, 'Lead Full-Stack Engineer | Innovate Tech Solutions', 0, 1)
pdf.set_font('Arial', 'I', 10)
pdf.cell(0, 5, '2020 - Present', 0, 1)
pdf.ln(2)
pdf.body_text('- Led a team of 10 developers to build a high-traffic e-commerce platform serving 1M+ monthly users.\n- Architected microservices using Node.js and Docker, reducing system downtime by 99.9%.\n- Implemented CI/CD pipelines with GitHub Actions, cutting deployment time by 60%.')

# Skills
pdf.section_title('Technical Skills')
pdf.body_text('Frontend: React, TypeScript, Next.js, Tailwind CSS\nBackend: Node.js, Python (FastAPI), Go, PostgreSQL, Redis\nCloud/DevOps: AWS (ECS, RDS, S3), Kubernetes, Terraform, Docker')

# Education
pdf.section_title('Education')
pdf.set_font('Arial', 'B', 11)
pdf.cell(0, 7, 'M.S. in Computer Science', 0, 1)
pdf.set_font('Arial', '', 11)
pdf.cell(0, 5, 'University of Technology, 2018', 0, 1)

pdf.output('professional_resume.pdf')
