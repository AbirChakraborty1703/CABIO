import React, { useRef, useState, useEffect, useContext } from 'react'
import { Link } from 'react-router-dom'
import CaptainDetails from '../components/CaptainDetails'
import RidePopUp from '../components/RidePopUp'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import ConfirmRidePopUp from '../components/ConfirmRidePopUp'
import { SocketContext } from '../context/SocketContext'
import { CaptainDataContext } from '../context/CapatainContext'
import axios from 'axios'

const CaptainHome = () => {
    const [ ridePopupPanel, setRidePopupPanel ] = useState(false)
    const [ confirmRidePopupPanel, setConfirmRidePopupPanel ] = useState(false)
    const ridePopupPanelRef = useRef(null)
    const confirmRidePopupPanelRef = useRef(null)
    const [ ride, setRide ] = useState(null)
    const { socket } = useContext(SocketContext)
    const { captain, setCaptain } = useContext(CaptainDataContext)

    // Keep captain's location up-to-date in backend and in-memory state
    useEffect(() => {
        if (!captain || !captain._id) return;

        socket.emit('join', {
            userId: captain._id,
            userType: 'captain'
        });

        let locationInterval;
        const updateLocation = () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    async position => {
                        const coords = {
                            ltd: position.coords.latitude,
                            lng: position.coords.longitude
                        }
                        socket.emit('update-location-captain', {
                            userId: captain._id,
                            location: coords
                        })
                        // Optionally update backend and local state
                        try {
                            await axios.post(`${import.meta.env.VITE_BASE_URL}/captains/update-location`, {
                                coordinates: [coords.lng, coords.ltd]
                            }, {
                                headers: {
                                    Authorization: `Bearer ${localStorage.getItem('token')}`
                                }
                            })
                            setCaptain(prev => ({
                                ...prev,
                                location: {
                                    ...prev.location,
                                    coordinates: [coords.lng, coords.ltd]
                                }
                            }))
                        } catch (err) {
                            // ignore location update errors
                        }
                    },
                    err => { /* ignore geolocation errors */ }
                )
            }
        }
        locationInterval = setInterval(updateLocation, 10000)
        updateLocation()

        // Listen for new-ride event
        const handleNewRide = (data) => {
            setRide(data)
            setRidePopupPanel(true)
        }
        socket.on('new-ride', handleNewRide)

        // Listen for ride-cancelled event (optional)
        const handleRideCancelled = () => {
            setRide(null)
            setRidePopupPanel(false)
            setConfirmRidePopupPanel(false)
        }
        socket.on('ride-cancelled', handleRideCancelled)

        // Cleanup on unmount
        return () => {
            clearInterval(locationInterval)
            socket.off('new-ride', handleNewRide)
            socket.off('ride-cancelled', handleRideCancelled)
        }
    }, [captain?._id])

    // Listen for ride updates in real-time (optional)
    useEffect(() => {
        if (!socket) return;
        const handleRideUpdate = (updatedRide) => {
            if (ride && updatedRide._id === ride._id) {
                setRide(updatedRide)
            }
        }
        socket.on('ride-updated', handleRideUpdate)
        return () => {
            socket.off('ride-updated', handleRideUpdate)
        }
    }, [ride, socket])

    async function confirmRide() {
        try {
            const response = await axios.post(`${import.meta.env.VITE_BASE_URL}/rides/confirm`, {
                rideId: ride._id,
                captainId: captain._id,
            }, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                }
            })
            setRide(response.data)
            setRidePopupPanel(false)
            setConfirmRidePopupPanel(true)
        } catch (err) {
            // handle error (e.g. show toast)
            setRidePopupPanel(false)
        }
    }

    useGSAP(function () {
        if (ridePopupPanel) {
            gsap.to(ridePopupPanelRef.current, {
                transform: 'translateY(0)'
            })
        } else {
            gsap.to(ridePopupPanelRef.current, {
                transform: 'translateY(100%)'
            })
        }
    }, [ ridePopupPanel ])

    useGSAP(function () {
        if (confirmRidePopupPanel) {
            gsap.to(confirmRidePopupPanelRef.current, {
                transform: 'translateY(0)'
            })
        } else {
            gsap.to(confirmRidePopupPanelRef.current, {
                transform: 'translateY(100%)'
            })
        }
    }, [ confirmRidePopupPanel ])

    return (
        <div className='h-screen'>
            <div className='fixed p-6 top-0 flex items-center justify-between w-screen'>
                <h1 className='ml-2 pb-5 text-black text-3xl'>Cabio</h1>
                <Link to='/captain-home' className=' h-10 w-10 bg-white flex items-center justify-center rounded-full'>
                    <i className="text-lg font-medium ri-logout-box-r-line"></i>
                </Link>
            </div>
            <div className='h-3/5'>
                <img className='h-full w-full object-cover' src="https://miro.medium.com/v2/resize:fit:1400/0*gwMx05pqII5hbfmX.gif" alt="" />
            </div>
            <div className='h-2/5 p-6'>
                <CaptainDetails />
            </div>
            <div ref={ridePopupPanelRef} className='fixed w-full z-10 bottom-0 translate-y-full bg-white px-3 py-10 pt-12'>
                <RidePopUp
                    ride={ride}
                    setRidePopupPanel={setRidePopupPanel}
                    setConfirmRidePopupPanel={setConfirmRidePopupPanel}
                    confirmRide={confirmRide}
                />
            </div>
            <div ref={confirmRidePopupPanelRef} className='fixed w-full h-screen z-10 bottom-0 translate-y-full bg-white px-3 py-10 pt-12'>
                <ConfirmRidePopUp
                    ride={ride}
                    setConfirmRidePopupPanel={setConfirmRidePopupPanel} setRidePopupPanel={setRidePopupPanel} />
            </div>
        </div>
    )
}

export default CaptainHome