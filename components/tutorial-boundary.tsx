"use client";
import { Component } from "react";
type Props={onError:()=>void;children:React.ReactNode};
/** Also catches a failed lazy chunk, before the tutorial's internal boundary mounts. */
export class TutorialBoundary extends Component<Props,{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return{failed:true};}
  componentDidCatch(){this.props.onError();}
  render(){return this.state.failed?null:this.props.children;}
}
