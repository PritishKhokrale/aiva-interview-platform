from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

LANGUAGE_MAP = {
    "python": 71,
    "cpp": 54,
    "java": 62,
    "javascript": 63
}

PROBLEMS = {
    "two_sum": {
        "title": "Two Sum",
        "description": "Given an array of integers <code>nums</code> and an integer <code>target</code>, return <em>indices of the two numbers such that they add up to target</em>.<br><br>You may assume that each input would have <strong>exactly one solution</strong>, and you may not use the same element twice.<br><br>You can return the answer in any order.<br><br><strong>Example 1:</strong><br><pre><b>Input:</b> 2 7 11 15\n<b>Target:</b> 9\n<b>Output:</b> 0 1\n<b>Explanation:</b> Because nums[0] + nums[1] == 9, we return 0 1.</pre><strong>Constraints:</strong><ul><li><code>2 &lt;= nums.length &lt;= 10<sup>4</sup></code></li><li><code>-10<sup>9</sup> &lt;= nums[i] &lt;= 10<sup>9</sup></code></li><li><code>-10<sup>9</sup> &lt;= target &lt;= 10<sup>9</sup></code></li></ul><strong>Input format expected:</strong><br>First line has array elements separated by spaces.<br>Second line has the target integer.",
        "test_cases": [
            {"input": "2 7 11 15\n9", "expected": "0 1"},
            {"input": "3 2 4\n6", "expected": "1 2"},
            {"input": "3 3\n6", "expected": "0 1"}
        ]
    },
    "reverse_string": {
        "title": "Reverse String",
        "description": "Write a function that reverses a string. The input string is given as an array of characters <code>s</code>.<br><br>You must do this by modifying the input array in-place with <code>O(1)</code> extra memory.<br><br><strong>Example 1:</strong><br><pre><b>Input:</b> s = \"hello\"\n<b>Output:</b> \"olleh\"</pre><strong>Constraints:</strong><ul><li><code>1 &lt;= s.length &lt;= 10<sup>5</sup></code></li><li><code>s</code> consists of printable ascii characters.</li></ul>",
        "test_cases": [
            {"input": "hello", "expected": "olleh"},
            {"input": "AIVA", "expected": "AVIA"},
            {"input": "racecar", "expected": "racecar"}
        ]
    },
    "fizzbuzz": {
        "title": "FizzBuzz",
        "description": "Given an integer <code>n</code>, return a string array <code>answer</code> (1-indexed) where:<br><ul><li><code>answer[i] == \"FizzBuzz\"</code> if <code>i</code> is divisible by 3 and 5.</li><li><code>answer[i] == \"Fizz\"</code> if <code>i</code> is divisible by 3.</li><li><code>answer[i] == \"Buzz\"</code> if <code>i</code> is divisible by 5.</li><li><code>answer[i] == i</code> (as a string) if none of the above conditions are true.</li></ul><br><strong>Example 1:</strong><br><pre><b>Input:</b> n = 3\n<b>Output:</b>\n1\n2\nFizz</pre><strong>Constraints:</strong><ul><li><code>1 &lt;= n &lt;= 10<sup>4</sup></code></li></ul>",
        "test_cases": [
            {"input": "3", "expected": "1\n2\nFizz"},
            {"input": "5", "expected": "1\n2\nFizz\n4\nBuzz"}
        ]
    },
    "valid_parentheses": {
        "title": "Valid Parentheses",
        "description": "Given a string <code>s</code> containing just the characters <code>'('</code>, <code>')'</code>, <code>'{'</code>, <code>'}'</code>, <code>'['</code> and <code>']'</code>, determine if the input string is valid.<br><br>An input string is valid if:<br><ol><li>Open brackets must be closed by the same type of brackets.</li><li>Open brackets must be closed in the correct order.</li><li>Every close bracket has a corresponding open bracket of the same type.</li></ol><br><strong>Example 1:</strong><br><pre><b>Input:</b> s = \"()\"\n<b>Output:</b> true</pre><br><strong>Example 2:</strong><br><pre><b>Input:</b> s = \"()[]{}\"\n<b>Output:</b> true</pre><br><strong>Example 3:</strong><br><pre><b>Input:</b> s = \"(]\"\n<b>Output:</b> false</pre><strong>Constraints:</strong><ul><li><code>1 &lt;= s.length &lt;= 10<sup>4</sup></code></li><li><code>s</code> consists of parentheses only.</li></ul>",
        "test_cases": [
            {"input": "()", "expected": "true"},
            {"input": "()[]{}", "expected": "true"},
            {"input": "(]", "expected": "false"}
        ]
    }
}

@app.route("/run", methods=["POST"])
def run_code():

    data = request.json
    code = data["code"]
    language = data["language"]

    language_id = LANGUAGE_MAP.get(language)

    url = "https://ce.judge0.com/submissions?base64_encoded=false&wait=true"
    input_data = data.get("input", "")

    payload = {
        "language_id": language_id,
        "source_code": code,
        "stdin": input_data
    }

    headers = {
        "content-type": "application/json"
    }

    response = requests.post(url, json=payload, headers=headers)

    result = response.json()

    return jsonify({
        "output": result.get("stdout"),
        "error": result.get("stderr") or result.get("compile_output") or result.get("message")
    })

@app.route("/problem", methods=["GET"])
def get_problem():
    import random
    problem_key = random.choice(list(PROBLEMS.keys()))
    problem_data = PROBLEMS[problem_key].copy()
    problem_data["id"] = problem_key # Pass ID so frontend can submit against it
    return jsonify(problem_data)

@app.route("/submit", methods=["POST"])
def submit_code():

    data = request.json

    code = data.get("code")
    language = data.get("language")

    language_id = LANGUAGE_MAP.get(language)

    problem_id = data.get("problem_id", "two_sum")
    
    if problem_id not in PROBLEMS:
        return jsonify({"passed": 0, "total": 0, "results": [{"testcase": 1, "status": "Failed - Problem not found"}]})
        
    test_cases = PROBLEMS[problem_id]["test_cases"]

    passed = 0
    results = []

    for i, case in enumerate(test_cases):

        payload = {
            "language_id": language_id,
            "source_code": code,
            "stdin": case["input"]
        }

        response = requests.post(
            "https://ce.judge0.com/submissions?base64_encoded=false&wait=true",
            json=payload
        )

        result = response.json()

        output = (result.get("stdout") or "").strip()
        expected = case["expected"].strip()

        is_passed = False
        if output == expected:
            is_passed = True
        elif problem_id == "two_sum":
            # For Two Sum, indices can be in any order. 
            # Normalize by sorting both output and expected strings.
            try:
                out_parts = sorted(output.split())
                exp_parts = sorted(expected.split())
                if out_parts == exp_parts:
                    is_passed = True
            except:
                pass

        if is_passed:
            passed += 1
            results.append({
                "testcase": i + 1,
                "status": "Passed"
            })
        else:
            results.append({
                "testcase": i + 1,
                "status": "Failed"
            })

    return jsonify({
        "passed": passed,
        "total": len(test_cases),
        "results": results
    })

if __name__ == "__main__":
    app.run(debug=True, port=5002)