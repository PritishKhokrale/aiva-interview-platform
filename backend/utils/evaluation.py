def calculate_overall_score(evaluations):
    if not evaluations:
        return 0
    total = sum(e.get('score', 0) for e in evaluations)
    return total / len(evaluations)
