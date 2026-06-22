package com.instana.robotshop.shipping;

/**
 * Bean to hold shipping information
 */
public class Ship {

    private double cost;
    private String delivery;

    public Ship() {
        this.cost = 0.0;
        this.delivery = "";
    }

    public Ship(double cost, String delivery) {
        this.cost = cost;
        this.delivery = delivery;
    }

    public void setCost(double cost) {
        this.cost = cost;
    }

    public void setDelivery(String delivery) {
        this.delivery = delivery;
    }

    public double getCost() {
        return this.cost;
    }

    public String getDelivery() {
        return this.delivery;
    }

    @Override
    public String toString() {
        return String.format("Delivery: %s | Cost: %.2f", delivery, cost);
    }
}