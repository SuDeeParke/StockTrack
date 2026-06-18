"""Export Pydantic model schemas to JSON files for frontend TypeScript type generation."""

import json
from pathlib import Path

from app.models import Signal, Stock, OHLCVBar, IndicatorSnapshot

OUTPUT_DIR = (
    Path(__file__).parent.parent.parent
    / "frontend"
    / "src"
    / "types"
    / "schemas"
)


def export_schemas():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    schemas = {
        "Signal": Signal,
        "Stock": Stock,
        "OHLCVBar": OHLCVBar,
        "IndicatorSnapshot": IndicatorSnapshot,
    }
    for name, model in schemas.items():
        schema_path = OUTPUT_DIR / f"{name}.json"
        schema_path.write_text(json.dumps(model.model_json_schema(), indent=2))
        print(f"Exported: {schema_path}")


if __name__ == "__main__":
    export_schemas()
