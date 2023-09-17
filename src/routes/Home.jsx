import * as React from "react";

export default function Home(){
    return(
        <div>
            <h1 style={{textAlign:"center"}}>Welcome to Candor Logistics</h1>
            <img src="../truckBackground.png" style={{ width: "100%", height: "100%" }}></img>
            <button style={{color:"blue"}}>Request Pickup/Delivery</button>
        </div>
    
    )
}