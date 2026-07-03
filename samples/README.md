# Sample Lab Reports

These CSV files are sample lab report inputs you can use to test the `/api/analyze` endpoint without uploading a real report.

## Files

- `sample_labs.csv` — minimal 2-row sample (Hemoglobin + Ferritin, both abnormal)
- `report_test.csv` — 4-row sample (Hemoglobin + WBC + Glucose + TSH)

## Usage

```bash
# Upload via curl
curl -X POST http://localhost:8000/api/analyze \
  -F "file=@samples/sample_labs.csv" \
  -F "profile=general"

# Or upload via the FeelFit web UI → Analyze tab → "browse files"
```
