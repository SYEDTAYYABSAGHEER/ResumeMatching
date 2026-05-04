from app.models.entities import Candidate, Job, JobRequirement, RequirementType


def seed_dummy_data(db):
    existing_candidates = db.query(Candidate).count()
    existing_jobs = db.query(Job).count()

    if existing_candidates == 0:
        candidates = [
            Candidate(
                full_name='Ayesha Khan',
                email='ayesha.khan@example.com',
                current_title='Backend Engineer',
                years_of_experience=4.5,
                raw_text='Python, FastAPI, PostgreSQL, Docker, AWS. Built APIs and microservices for fintech workloads.',
            ),
            Candidate(
                full_name='Bilal Ahmed',
                email='bilal.ahmed@example.com',
                current_title='Data Analyst',
                years_of_experience=3.0,
                raw_text='SQL, Power BI, Python, Pandas. Built hiring and sales dashboards and automated reporting.',
            ),
            Candidate(
                full_name='Fatima Noor',
                email='fatima.noor@example.com',
                current_title='Frontend Developer',
                years_of_experience=5.0,
                raw_text='React, JavaScript, TypeScript, CSS, UX. Built HR web portals and component libraries.',
            ),
            Candidate(
                full_name='Hassan Raza',
                email='hassan.raza@example.com',
                current_title='DevOps Engineer',
                years_of_experience=6.0,
                raw_text='Kubernetes, CI/CD, Terraform, AWS, Linux. Managed cloud infrastructure and deployment pipelines.',
            ),
            Candidate(
                full_name='Sara Iqbal',
                email='sara.iqbal@example.com',
                current_title='Machine Learning Engineer',
                years_of_experience=4.0,
                raw_text='Python, scikit-learn, NLP, vector search, model evaluation. Built resume parsing and ranking tools.',
            ),
        ]
        db.add_all(candidates)
        db.flush()

    if existing_jobs == 0:
        jobs = [
            Job(
                title='Senior Python Developer',
                company='TalentBridge',
                location='Remote',
                seniority='Senior',
                description_text='Build and maintain backend APIs for hiring and screening workflows.',
            ),
            Job(
                title='Frontend React Engineer',
                company='HireStack',
                location='Lahore',
                seniority='Mid',
                description_text='Develop recruiter dashboards and improve candidate experience on web portals.',
            ),
            Job(
                title='Data & ML Engineer',
                company='MatchLabs',
                location='Karachi',
                seniority='Mid-Senior',
                description_text='Create matching pipelines, scoring models, and analytics for talent data.',
            ),
        ]
        db.add_all(jobs)
        db.flush()

        requirements = [
            JobRequirement(job_id=jobs[0].id, requirement_text='Python', requirement_type=RequirementType.mandatory),
            JobRequirement(job_id=jobs[0].id, requirement_text='FastAPI', requirement_type=RequirementType.preferred),
            JobRequirement(job_id=jobs[0].id, requirement_text='PostgreSQL', requirement_type=RequirementType.preferred),
            JobRequirement(job_id=jobs[1].id, requirement_text='React', requirement_type=RequirementType.mandatory),
            JobRequirement(job_id=jobs[1].id, requirement_text='TypeScript', requirement_type=RequirementType.preferred),
            JobRequirement(job_id=jobs[1].id, requirement_text='UI/UX collaboration', requirement_type=RequirementType.optional),
            JobRequirement(job_id=jobs[2].id, requirement_text='Python', requirement_type=RequirementType.mandatory),
            JobRequirement(job_id=jobs[2].id, requirement_text='Machine Learning', requirement_type=RequirementType.preferred),
            JobRequirement(job_id=jobs[2].id, requirement_text='SQL', requirement_type=RequirementType.preferred),
        ]
        db.add_all(requirements)

    db.commit()
