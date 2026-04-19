import React, { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";

window.addEventListener("error", (e) => {
  if (e.message === "ResizeObserver loop completed with undelivered notifications.") {
    const resizeObserverErrDiv = document.getElementById("webpack-dev-server-client-overlay");
    if (resizeObserverErrDiv) {
      resizeObserverErrDiv.style.display = "none";
    }
  }
});

function CodingIDE() {

  const [code, setCode] = useState("// Write your solution here");
  const [language, setLanguage] = useState("python");
  const [output, setOutput] = useState("");
  const [problem, setProblem] = useState(null);
  const [input, setInput] = useState("");
  const [testResults, setTestResults] = useState([]);
  const [isLoadingRun, setIsLoadingRun] = useState(false);
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);

  useEffect(() => {
    fetch("http://127.0.0.1:5002/problem")
      .then(res => res.json())
      .then(data => {
          setProblem(data);
          if (data.test_cases && data.test_cases.length > 0) {
              setInput(data.test_cases[0].input);
          }
      })
      .catch(err => console.error("Could not fetch problem:", err));
  }, []);

  const runCode = async () => {
    setIsLoadingRun(true);
    try {
      const response = await fetch("http://127.0.0.1:5002/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code, language: language, input: input })
      });

    const data = await response.json();

    if (data.output !== undefined && data.output !== null) {
      setOutput(data.output === "" ? "Program executed successfully with no output." : data.output);
    } else if (data.error) {
      setOutput(data.error);
    } else {
      setOutput("Program executed successfully. No output returned.");
    }
  } catch (err) {
    console.error("Run failed", err);
    setOutput("Execution server failed to run.");
  } finally {
    setIsLoadingRun(false);
  }
};

  const submitCode = async () => {
    setIsLoadingSubmit(true);
    try {
      const response = await fetch("http://127.0.0.1:5002/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code, language: language, problem_id: problem?.id })
      });

  const data = await response.json();

  setTestResults(data.results);
  setOutput(`Passed ${data.passed} / ${data.total} test cases`);
  } catch (err) {
    console.error("Submit failed", err);
    setOutput("Execution server failed to submit.");
  } finally {
    setIsLoadingSubmit(false);
  }
};

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#0f172a", color: "#f8fafc", fontFamily: "'Inter', sans-serif" }}>

      {/* TOP NAVIGATION BAR */}
      <div style={{ padding: "0 20px", height: "60px", background: "#1e293b", borderBottom: "1px solid #334155", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div style={{ background: "rgba(56, 189, 248, 0.1)", color: "#38bdf8", padding: "8px 12px", borderRadius: "8px", fontWeight: "bold" }}>
                {"</>"}
            </div>
            <h3 style={{ margin: "0", fontSize: "1.1rem", fontWeight: "600", color: "#e2e8f0" }}>AIVA Code Practice</h3>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <select
            value={language}
            onChange={(e)=>setLanguage(e.target.value)}
            style={{ padding: "8px 12px", background: "#0f172a", color: "#e2e8f0", border: "1px solid #334155", borderRadius: "6px", outline: "none", cursor: "pointer", fontWeight: "500" }}
            >
            <option value="python">Python</option>
            <option value="cpp">C++</option>
            <option value="java">Java</option>
            <option value="javascript">JavaScript</option>
            </select>

            <button onClick={runCode} disabled={isLoadingRun || isLoadingSubmit} style={{ background: "rgba(255, 255, 255, 0.1)", color: "white", padding: "8px 16px", borderRadius: "6px", border: "none", cursor: (isLoadingRun || isLoadingSubmit) ? "not-allowed" : "pointer", fontWeight: "600", transition: "0.2s" }} onMouseOver={e => {if(!isLoadingRun && !isLoadingSubmit) e.target.style.background="rgba(255,255,255,0.15)"}} onMouseOut={e => {if(!isLoadingRun && !isLoadingSubmit) e.target.style.background="rgba(255,255,255,0.1)"}}>
            {isLoadingRun ? (
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span className="spinner">🏃</span> Running...</span>
            ) : "Run"}
            </button>

            <button onClick={submitCode} disabled={isLoadingRun || isLoadingSubmit} style={{ background: "#22c55e", color: "white", padding: "8px 16px", borderRadius: "6px", border: "none", cursor: (isLoadingRun || isLoadingSubmit) ? "not-allowed" : "pointer", fontWeight: "600", transition: "0.2s", boxShadow: "0 4px 14px 0 rgba(34, 197, 94, 0.39)", opacity: (isLoadingRun || isLoadingSubmit) ? 0.7 : 1 }} onMouseOver={e => {if(!isLoadingRun && !isLoadingSubmit) e.target.style.background="#16a34a"}} onMouseOut={e => {if(!isLoadingRun && !isLoadingSubmit) e.target.style.background="#22c55e"}}>
            {isLoadingSubmit ? (
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span className="spinner">⏳</span> Testing...</span>
            ) : "Submit Code"}
            </button>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT PANEL */}
        <div style={{ width: "40%", display: "flex", flexDirection: "column", borderRight: "1px solid #334155", background: "#0f172a" }}>

          {/* PROBLEM DESC */}
          <div style={{ flex: 2, padding: "24px", overflow: "auto", borderBottom: "1px solid #334155" }}>
            {problem ? (
              <>
                <h2 style={{ fontSize: "1.5rem", marginBottom: "16px", color: "#f8fafc" }}>{problem.title}</h2>
                <div style={{ color: "#cbd5e1", lineHeight: "1.7", fontSize: "0.95rem" }} dangerouslySetInnerHTML={{ __html: problem.description }} />
              </>
            ) : (
                <div style={{ color: "#64748b", display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>Loading Problem...</div>
            )}
          </div>

          {/* CUSTOM INPUT */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#1e293b" }}>
            <div style={{ padding: "8px 16px", background: "#0f172a", borderBottom: "1px solid #334155", fontSize: "0.85rem", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase" }}>
                Custom Input
            </div>
            <textarea
              value={input}
              onChange={(e)=>setInput(e.target.value)}
              placeholder="Enter stdin variables here..."
              style={{ flex: 1, width: "100%", background: "transparent", border: "none", color: "#f8fafc", padding: "16px", outline: "none", resize: "none", fontFamily: "monospace" }}
            />
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{ width: "60%", display: "flex", flexDirection: "column" }}>

          {/* EDITOR */}
          <div style={{ flex: 3, minHeight: "300px", position: "relative" }}>
            <Editor
              height="100%"
              theme="vs-dark"
              language={language}
              value={code}
              onChange={(value)=>setCode(value)}
              options={{ automaticLayout: true, minimap: { enabled: false }, fontSize: 14, padding: { top: 16 } }}
            />
          </div>

          {/* TERMINAL OUTPUT */}
          <div style={{ flex: 1.5, background: "#020617", borderTop: "1px solid #334155", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "8px 16px", background: "#0f172a", borderBottom: "1px solid #334155", fontSize: "0.85rem", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", display: "flex", gap: "20px" }}>
                <span>Terminal Output</span>
            </div>
            <div style={{ color: "#a3e635", padding: "16px", overflow: "auto", fontFamily: "monospace", fontSize: "0.9rem", flex: 1 }}>
              <pre style={{ margin: 0 }}>{output || "Run code to see output..."}</pre>
              
              {testResults.length > 0 && (
                <div style={{ marginTop: "20px", borderTop: "1px dashed #334155", paddingTop: "16px" }}>
                  {testResults.map((test, index) => (
                    <div key={index} style={{ marginBottom: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ color: "#94a3b8" }}>Test Case {test.testcase}</span>
                      {test.status === "Passed" ? (
                          <span style={{ color: "#22c55e", background: "rgba(34, 197, 94, 0.1)", padding: "2px 8px", borderRadius: "12px", fontSize: "0.8rem" }}>● Passed</span>
                      ) : (
                          <span style={{ color: "#ef4444", background: "rgba(239, 68, 68, 0.1)", padding: "2px 8px", borderRadius: "12px", fontSize: "0.8rem" }}>● Failed</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>

  );

}

export default CodingIDE;