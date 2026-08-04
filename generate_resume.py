from fpdf import FPDF

class ResumePDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 20)
        self.cell(0, 10, 'RAHUL SHARMA', 0, 1, 'C')
        self.set_font('Arial', '', 10)
        self.cell(0, 10, 'Email: rahul.sharma@email.com | Phone: +91-9876543210 | Location: Delhi, India', 0, 1, 'C')
        self.ln(10)

    def chapter_title(self, title):
        self.set_font('Arial', 'B', 14)
        self.set_fill_color(200, 220, 255)
        self.cell(0, 8, title, 0, 1, 'L', 1)
        self.ln(4)

    def body_text(self, text):
        self.set_font('Arial', '', 11)
        # Replacing unicode bullets with simple hyphens to avoid encoding errors
        text = text.replace('\u2022', '-')
        self.multi_cell(0, 7, text)
        self.ln(2)

pdf = ResumePDF()
pdf.add_page()

# Page 1
pdf.chapter_title('Professional Summary')
pdf.body_text('Highly motivated Software Engineer with 5+ years of experience in full-stack development, cloud architecture, and agile project management. Proven track record of optimizing application performance and leading cross-functional teams to deliver scalable solutions.')

pdf.chapter_title('Skills')
pdf.body_text('- Languages: Python, JavaScript, Java, C++\n- Frameworks: React, Node.js, Django, FastAPI\n- Cloud: AWS (EC2, S3, Lambda), Docker, Kubernetes\n- Tools: Git, Jenkins, Jira, PostgreSQL, MongoDB')

pdf.chapter_title('Experience')
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 7, 'Senior Software Developer | Tech Solutions Inc.', 0, 1)
pdf.set_font('Arial', '', 11)
pdf.body_text('- Spearheaded the migration of legacy monolithic architecture to microservices, reducing latency by 40%.\n- Mentored junior developers and conducted code reviews to ensure high-quality delivery.\n- Automated CI/CD pipelines using Jenkins, decreasing deployment time from 2 hours to 10 minutes.')

# Page 2
pdf.add_page()
pdf.chapter_title('Education')
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 7, 'Bachelor of Technology in Computer Science', 0, 1)
pdf.set_font('Arial', '', 11)
pdf.cell(0, 7, 'Indian Institute of Technology (IIT), Delhi | 2015 - 2019', 0, 1)
pdf.ln(5)

pdf.chapter_title('Projects')
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 7, 'AI-Powered Analytics Dashboard', 0, 1)
pdf.set_font('Arial', '', 11)
pdf.body_text('Developed a real-time data visualization tool using React and Python, integrating machine learning models to predict market trends with 85% accuracy.')

pdf.chapter_title('Certifications')
pdf.body_text('- AWS Certified Solutions Architect\n- Google Professional Cloud Developer\n- Meta Front-End Developer Professional Certificate')

pdf.output('resume_mock.pdf')
