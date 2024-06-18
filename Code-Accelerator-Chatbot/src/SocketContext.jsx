//SocketContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('verificationToken');

        const newSocket = io('http://localhost:4000', {
            auth: {
                token: token
            }
        });

        setSocket(newSocket);


        newSocket.on("disconnect", () => {
            console.log("Client disconnected --- 9999");
            newSocket.close();
        });

        newSocket.on("connected",()=>{
            console.log("Client Connected");
        })

        newSocket.on("no-token",()=>{
            console.log("------------ No token ------------");
            navigate('/login');
        })

        newSocket.on("invalid-token", () => {
            console.log("------------------Token is invalid----------------");
            navigate('/login'); // Redirect to the login page
        });

        return () => newSocket.close();
    }, [navigate]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};

SocketProvider.propTypes = {
    children: PropTypes.node.isRequired,
};













// //SocketContext.jsx
// import React, { createContext, useContext, useEffect, useState } from 'react';
// import io from 'socket.io-client';
// import PropTypes from 'prop-types';

// const SocketContext = createContext();

// export const useSocket = () => useContext(SocketContext);

// export const SocketProvider = ({ children }) => {
//     const [socket, setSocket] = useState(null);

//     useEffect(() => {
//         const token = localStorage.getItem('verificationToken');
        

//         const newSocket = io('http://localhost:4000', {
//                 auth: {
//                     token: token 
//                 }
//         });

//         setSocket(newSocket);

//         newSocket.on('token-expired',()=>{
//             console.log("TOKEN EXPIRED");

//         });

//         newSocket.on("disconnect", ()=>{
//             console.log("client disconnected --- 9999")
//             newSocket.close()
//         })

//         newSocket.on("no-token", ()=>{
//             console.log("no token sent")
//         })

//         newSocket.on("invalid-token",()=>{
//             console.log("------------------token is invalid----------------");
//         })

//         return () => newSocket.close();
//     }, []);

//     return (
//         <SocketContext.Provider value={socket}>
//             {children}
//         </SocketContext.Provider>
//     );
// };

// SocketProvider.propTypes = {
//     children: PropTypes.func.isRequired,
// }