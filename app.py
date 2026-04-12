import streamlit as st
import pandas as pd
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import PyPDF2
import docx2txt
import io

# Page Configuration
st.set_page_config(page_title="Resume Screening System", layout="wide")

# Theme Style
st.markdown("""
    <style>
    .main {
        background-color: #f5f7f9;
    }
    .stTitle {
        color: #1e3d59;
        font-family: 'Outfit', sans-serif;
    }
    .stHeader {
        color: #1e3d59;
    }
    </style>
    """, unsafe_allow_html=True)

# LOAD MODEL
@st.cache_resource
def load_model():
    return SentenceTransformer('all-MiniLM-L6-v2')

model = load_model()

# TEXT EXTRACTION UTILS
def extract_text_from_pdf(file):
    reader = PyPDF2.PdfReader(file)
    text = ""
    for page in reader.pages:
        text += page.extract_text()
    return text

def extract_text_from_docx(file):
    return docx2txt.process(file)

# APP LAYOUT
st.title("🚀 Resume Screening & Ranking System")
st.write("Using Sentence Transformers & Cosine Similarity for Semantic Evaluation.")

col1, col2 = st.columns([1, 1])

with col1:
    st.header("1. Job Description")
    jd_input = st.text_area("Paste the Job Description here:", height=300)

with col2:
    st.header("2. Upload Resumes")
    uploaded_files = st.file_uploader("Upload PDF or DOCX resumes (Multiple files allowed)", 
                                     type=['pdf', 'docx'], 
                                     accept_multiple_files=True)

if st.button("Analyze and Rank"):
    if not jd_input:
        st.warning("Please provide a Job Description.")
    elif not uploaded_files:
        st.warning("Please upload at least one resume.")
    else:
        with st.spinner("Processing resumes and calculating semantic similarity..."):
            resumes_data = []
            
            # 1. PREPROCESS JD
            jd_embedding = model.encode([jd_input])
            
            # 2. PROCESS EACH RESUME
            for file in uploaded_files:
                try:
                    if file.name.endswith(".pdf"):
                        resume_text = extract_text_from_pdf(file)
                    else:
                        resume_text = extract_text_from_docx(file)
                    
                    # Compute Embedding
                    resume_embedding = model.encode([resume_text])
                    
                    # Compute Similarity
                    similarity_score = cosine_similarity(jd_embedding, resume_embedding)[0][0]
                    
                    resumes_data.append({
                        "Candidate Name": file.name,
                        "Similarity Score (%)": round(float(similarity_score) * 100, 2),
                        "Status": "Highly Relevant" if similarity_score > 0.7 else ("Potential Match" if similarity_score > 0.4 else "Not Relevant")
                    })
                except Exception as e:
                    st.error(f"Error processing {file.name}: {e}")

            # 3. RANK AND DISPLAY
            if resumes_data:
                results_df = pd.DataFrame(resumes_data)
                results_df = results_df.sort_values(by="Similarity Score (%)", ascending=False)
                
                st.success("Analysis Complete!")
                st.header("Ranked Results")
                
                # Interactive Table
                st.dataframe(results_df.style.background_gradient(subset=["Similarity Score (%)"], cmap="Blues"),
                             use_container_width=True)
                
                # Download Report
                csv = results_df.to_csv(index=False).encode('utf-8')
                st.download_button(
                    label="Download Ranking Report",
                    data=csv,
                    file_name="resume_ranking_report.csv",
                    mime="text/csv",
                )
            else:
                st.warning("No data extracted from the uploaded files.")

# FOOTER
st.markdown("---")
st.write("Senior Design Project: Resume Screening System Version 1.0")
