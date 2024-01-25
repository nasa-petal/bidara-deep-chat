from flask import Flask, send_from_directory  

app = Flask(__name__)  

# main route 
@app.route("/") 
def base():     
    return send_from_directory('public', 'index.html') 

@app.route("/<path:path>") 
def home(path):     
    return send_from_directory('public', path)  

@app.get("/test") 
def test():     
    return "this is a test"  

if __name__ == "__main__":     
    app.run(debug=True) 
