//Header.jsx
import  "./Header.css"
import codeLogo from "./../assets/codeAccelerate.svg";

export default function Header() {
    return (
        <header className="header">
          <img src={codeLogo}></img>
          <h1>COCO</h1>
          <p>Codewave&lsquo;s Own Code Officer</p>
        </header>
      );
}
 